import Foundation
import Observation

enum DataPhase: Equatable {
    case idle
    case loading
    case loaded
    case localReady
    case partial(String)
    case failed(String)
}

enum CaptureOutcome: Equatable {
    case synced
    case queued

    var message: String {
        switch self {
        case .synced: "Saved to Codex."
        case .queued: "Saved on this iPhone."
        }
    }
}

@MainActor
@Observable
final class PocketForgeStore {
    private let api: PocketForgeAPI
    private let pendingStore: PendingCaptureStore
    private let biometrics: any BiometricAuthenticating

    var phase: DataPhase = .idle
    var isAuthenticated = false
    var isOwnerEnrolled = false
    var isUnlocking = false
    var ownerEmail: String?
    var captures: [CaptureRecord] = []
    var pendingCaptures: [PendingCapture] = []
    var readiness: Readiness?
    var workspaces: [WorkspaceRecord] = []
    var routes: [RoutedRequestRecord] = []
    var evidence: [EvidenceRecord] = []
    var contextResults: [CodexContextRecord] = []
    var contextSearchAvailable = false
    var hasRemoteSession = false
    var lastMessage: String?

    init(
        api: PocketForgeAPI = .shared,
        pendingStore: PendingCaptureStore = .shared,
        biometrics: any BiometricAuthenticating = FaceIDAuthenticator()
    ) {
        self.api = api
        self.pendingStore = pendingStore
        self.biometrics = biometrics
    }

    var lar: LARState { CognitionDeriver.lar(routes: routes, evidence: evidence) }
    var unresolvedInboxCount: Int { captures.filter { $0.state == .inbox }.count + pendingCaptures.count }
    var blockedCount: Int { routes.filter { $0.isLive && $0.isBlocked }.count }
    var pendingEvidenceCount: Int { evidence.filter { ["pending", "unverified", "conflict", "stale"].contains($0.status) }.count }

    func start() async {
        isOwnerEnrolled = LocalOwnerAccess.isEnrolled
        hasRemoteSession = await api.isAuthenticated
        ownerEmail = await api.ownerEmail ?? LocalOwnerAccess.enrollment()?.email
        pendingCaptures = await pendingStore.all()
        if isAuthenticated {
            await refresh()
        }
    }

    func unlockWithFaceID() async {
        isUnlocking = true
        defer { isUnlocking = false }
        phase = .loading
        do {
            try await biometrics.authenticate()
            if !LocalOwnerAccess.isEnrolled {
                try LocalOwnerAccess.enroll()
            }
            isOwnerEnrolled = true
            isAuthenticated = true
            hasRemoteSession = await api.isAuthenticated
            ownerEmail = await api.ownerEmail ?? LocalOwnerAccess.enrollment()?.email ?? "Local owner"
            pendingCaptures = await pendingStore.all()
            await refresh()
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func lock() async {
        isAuthenticated = false
        clearRemoteDerivedState()
        phase = .idle
    }

    func signOut() async {
        await api.signOut()
        LocalOwnerAccess.clear()
        isOwnerEnrolled = false
        isAuthenticated = false
        hasRemoteSession = false
        ownerEmail = nil
        clearRemoteDerivedState()
        pendingCaptures = []
        phase = .idle
    }

    func refresh() async {
        guard isAuthenticated else { return }
        phase = .loading
        await retryPendingCaptures()

        guard hasRemoteSession, AppConfig.isSupabaseConfigured else {
            phase = .localReady
            return
        }

        async let captureResult = result { try await api.captures() }
        async let readinessResult = result { try await api.readiness() }
        async let workspaceResult = result { try await api.workspaces() }
        async let routeResult = result { try await api.routes() }
        async let evidenceResult = result { try await api.evidence() }

        let results = await (captureResult, readinessResult, workspaceResult, routeResult, evidenceResult)
        var failures: [String] = []
        apply(results.0, to: &captures, failures: &failures)
        switch results.1 {
        case .success(let record): readiness = record?.readiness
        case .failure(let error): failures.append(error.localizedDescription)
        }
        apply(results.2, to: &workspaces, failures: &failures)
        apply(results.3, to: &routes, failures: &failures)
        apply(results.4, to: &evidence, failures: &failures)
        phase = failures.isEmpty ? .loaded : .partial(Array(Set(failures)).joined(separator: " · "))
    }

    func capture(text rawText: String, intention: CaptureIntention) async -> CaptureOutcome? {
        let text = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        var pending = PendingCapture(id: UUID(), text: text, intention: intention, createdAt: Date(), lastError: nil)

        guard hasRemoteSession else {
            try? await pendingStore.enqueue(pending)
            pendingCaptures = await pendingStore.all()
            lastMessage = CaptureOutcome.queued.message
            return .queued
        }

        do {
            _ = try await api.createCapture(pending)
            lastMessage = CaptureOutcome.synced.message
            await refresh()
            return .synced
        } catch {
            let apiError = error as? PocketForgeAPIError
            guard apiError?.canQueueCapture == true else {
                lastMessage = error.localizedDescription
                return nil
            }
            pending.lastError = error.localizedDescription
            try? await pendingStore.enqueue(pending)
            pendingCaptures = await pendingStore.all()
            lastMessage = CaptureOutcome.queued.message
            return .queued
        }
    }

    func promote(_ capture: CaptureRecord, to route: CaptureRoute) async -> Bool {
        do {
            _ = try await api.promoteCapture(id: capture.id, route: route)
            lastMessage = route == .archive ? "Archived in Codex." : "Promoted to \(route.label)."
            await refresh()
            return true
        } catch {
            lastMessage = error.localizedDescription
            return false
        }
    }

    func setReadiness(_ value: Readiness) async {
        guard hasRemoteSession else {
            readiness = value
            lastMessage = "Readiness saved on this iPhone."
            return
        }
        do {
            readiness = try await api.setReadiness(value).readiness
            lastMessage = "Readiness saved."
        } catch {
            lastMessage = error.localizedDescription
        }
    }

    func searchContext(_ query: String) async {
        guard hasRemoteSession else {
            contextResults = []
            contextSearchAvailable = false
            // No toast — CSF shows a calm local-mode empty state instead.
            return
        }
        do {
            contextResults = try await api.searchContext(query)
            contextSearchAvailable = true
        } catch {
            contextResults = []
            contextSearchAvailable = false
        }
    }

    func tinyStep(for route: RoutedRequestRecord) async -> String? {
        do {
            return try await api.tinyStep(for: route.intent)
        } catch {
            lastMessage = error.localizedDescription
            return nil
        }
    }

    func challenge(_ input: String) async -> RekAssessment? {
        do {
            return try await api.challenge(input)
        } catch {
            lastMessage = error.localizedDescription
            return nil
        }
    }

    func sendToFoundry(_ handoff: FoundryHandoff) async -> Bool {
        do {
            try await api.sendToFoundry(handoff)
            _ = try await api.promoteCapture(id: handoff.capture.id, route: .foundryRequest)
            lastMessage = "Foundry request recorded."
            await refresh()
            return true
        } catch {
            lastMessage = error.localizedDescription
            return false
        }
    }

    private func retryPendingCaptures() async {
        guard hasRemoteSession else { return }
        for pending in await pendingStore.all() {
            do {
                _ = try await api.createCapture(pending)
                try await pendingStore.remove(id: pending.id)
            } catch {
                var failed = pending
                failed.lastError = error.localizedDescription
                try? await pendingStore.enqueue(failed)
            }
        }
        pendingCaptures = await pendingStore.all()
    }

    private func clearRemoteDerivedState() {
        captures = []
        routes = []
        evidence = []
        workspaces = []
        contextResults = []
        readiness = nil
        contextSearchAvailable = false
    }

    private func apply<T>(_ result: Result<[T], Error>, to destination: inout [T], failures: inout [String]) {
        switch result {
        case .success(let values): destination = values
        case .failure(let error): failures.append(error.localizedDescription)
        }
    }
}

private func result<T>(_ operation: () async throws -> T) async -> Result<T, Error> {
    do { return .success(try await operation()) }
    catch { return .failure(error) }
}
