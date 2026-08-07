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
    private let localStore: LocalCaptureStore
    private let pendingStore: PendingCaptureStore
    private let biometrics: any BiometricAuthenticating

    var phase: DataPhase = .idle
    var isAuthenticated = false
    var isOwnerEnrolled = false
    var isUnlocking = false
    var ownerEmail: String?
    var captures: [CaptureRecord] = []
    var localCaptures: [LocalCapture] = []
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
        localStore: LocalCaptureStore = .shared,
        pendingStore: PendingCaptureStore = .shared,
        biometrics: any BiometricAuthenticating = FaceIDAuthenticator()
    ) {
        self.api = api
        self.localStore = localStore
        self.pendingStore = pendingStore
        self.biometrics = biometrics
    }

    var lar: LARState { CognitionDeriver.lar(routes: routes, evidence: evidence) }

    var unresolvedInboxCount: Int {
        if hasRemoteSession {
            return captures.filter { $0.state == .inbox }.count + pendingCaptures.count
        }
        return localCaptures.filter { $0.state == .inbox }.count
    }

    var blockedCount: Int { routes.filter { $0.isLive && $0.isBlocked }.count }
    var pendingEvidenceCount: Int {
        evidence.filter { ["pending", "unverified", "conflict", "stale"].contains($0.status) }.count
    }

    var openInboxCaptures: [CaptureRecord] {
        if hasRemoteSession {
            return captures.filter { $0.state == .inbox }
        }
        return localCaptures.filter { $0.state == .inbox }.map { $0.asCaptureRecord() }
    }

    var promotedCaptures: [CaptureRecord] {
        if hasRemoteSession {
            return captures.filter { $0.state == .promoted }
        }
        return localCaptures.filter { $0.state == .promoted }.map { $0.asCaptureRecord() }
    }

    func start() async {
        isOwnerEnrolled = LocalOwnerAccess.isEnrolled
        hasRemoteSession = await api.isAuthenticated
        ownerEmail = await api.ownerEmail ?? LocalOwnerAccess.enrollment()?.email
        await reloadLocalLedger()
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
            await reloadLocalLedger()
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
        // Keep localCaptures on disk — Face ID lock shouldn't wipe cognition.
        phase = .idle
    }

    func refresh() async {
        guard isAuthenticated else { return }
        phase = .loading
        await reloadLocalLedger()
        await retryPendingCaptures()

        guard hasRemoteSession, AppConfig.isSupabaseConfigured else {
            applyLocalCognition()
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
        // Keep local LAR/CSF useful even when remote is linked but empty.
        if routes.isEmpty {
            routes = localActionRoutes()
        }
        phase = failures.isEmpty ? .loaded : .partial(Array(Set(failures)).joined(separator: " · "))
    }

    func capture(text rawText: String, intention: CaptureIntention) async -> CaptureOutcome? {
        let text = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }

        guard hasRemoteSession else {
            var local = LocalCapture(
                id: UUID(),
                text: text,
                intention: intention,
                createdAt: Date(),
                state: .inbox,
                route: nil,
                promotedAt: nil,
                lastError: nil
            )
            // Honor LAR/CSF intention immediately so the right tab fills.
            let autoRoute = intention.preferredRoute
            if let autoRoute {
                local.state = .promoted
                local.route = autoRoute
                local.promotedAt = Date()
            }
            try? await localStore.upsert(local)
            await reloadLocalLedger()
            applyLocalCognition()
            if let autoRoute {
                lastMessage = "Saved and promoted to \(autoRoute.label) on this iPhone."
            } else {
                lastMessage = CaptureOutcome.queued.message
            }
            return .queued
        }

        var pending = PendingCapture(id: UUID(), text: text, intention: intention, createdAt: Date(), lastError: nil)
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
            // Fall through to durable local ledger instead of a dead-end queue.
            let local = LocalCapture(
                id: pending.id,
                text: pending.text,
                intention: pending.intention,
                createdAt: pending.createdAt,
                state: .inbox,
                route: nil,
                promotedAt: nil,
                lastError: pending.lastError
            )
            try? await localStore.upsert(local)
            await reloadLocalLedger()
            applyLocalCognition()
            lastMessage = CaptureOutcome.queued.message
            return .queued
        }
    }

    func promote(_ capture: CaptureRecord, to route: CaptureRoute) async -> Bool {
        if hasRemoteSession, !capture.tags.contains("source:local") {
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

        do {
            _ = try await localStore.promote(id: capture.id, route: route)
            await reloadLocalLedger()
            applyLocalCognition()
            lastMessage = route == .archive
                ? "Dismissed on this iPhone."
                : "Promoted to \(route.label) on this iPhone."
            return true
        } catch {
            lastMessage = error.localizedDescription
            return false
        }
    }

    func dismiss(_ capture: CaptureRecord) async {
        _ = await promote(capture, to: .archive)
    }

    func deleteLocal(_ capture: CaptureRecord) async {
        try? await localStore.remove(id: capture.id)
        await reloadLocalLedger()
        applyLocalCognition()
        lastMessage = "Removed from this iPhone."
    }

    /// Starts a Convex forge build from an inbox/promoted capture.
    func forge(from capture: CaptureRecord) async -> String? {
        let prompt = capture.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return nil }
        let name = String(prompt.prefix(32))
        do {
            let projectId = try await ConvexService.shared.createProject(
                name: name,
                prompt: "Build a beautiful website: \(prompt)",
                icon: "sparkles",
                provider: "auto"
            )
            Task.detached {
                try? await ConvexService.shared.build(projectId: projectId, prompt: prompt)
            }
            _ = await promote(capture, to: .project)
            lastMessage = "Forging on Convex — check the Forge tab."
            return projectId
        } catch {
            lastMessage = error.localizedDescription
            return nil
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
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if !hasRemoteSession {
            let local = localContextRecords()
            contextResults = needle.isEmpty
                ? local
                : local.filter {
                    $0.title.lowercased().contains(needle)
                        || $0.excerpt.lowercased().contains(needle)
                        || $0.section.lowercased().contains(needle)
                }
            contextSearchAvailable = true
            return
        }

        do {
            var remote = try await api.searchContext(query)
            if remote.isEmpty {
                let local = localContextRecords()
                remote = needle.isEmpty
                    ? local
                    : local.filter {
                        $0.title.lowercased().contains(needle)
                            || $0.excerpt.lowercased().contains(needle)
                            || $0.section.lowercased().contains(needle)
                    }
            }
            contextResults = remote
            contextSearchAvailable = true
        } catch {
            let local = localContextRecords()
            contextResults = needle.isEmpty
                ? local
                : local.filter {
                    $0.title.lowercased().contains(needle)
                        || $0.excerpt.lowercased().contains(needle)
                        || $0.section.lowercased().contains(needle)
                }
            contextSearchAvailable = true
        }
    }

    func tinyStep(for route: RoutedRequestRecord) async -> String? {
        if hasRemoteSession {
            do {
                return try await api.tinyStep(for: route.intent)
            } catch {
                // Fall through to local heuristic.
            }
        }
        return LocalCognition.tinyStep(for: route.intent)
    }

    func challenge(_ input: String, captureID: UUID? = nil) async -> RekAssessment? {
        if hasRemoteSession {
            do {
                return try await api.challenge(input)
            } catch {
                // Fall through to local heuristic.
            }
        }
        return LocalCognition.challenge(
            input,
            against: localChallengeCorpus(excluding: captureID),
            claimCaptureID: captureID
        )
    }

    /// Promote/create the challenged claim as CSF evidence so future REKs have a source.
    @discardableResult
    func saveAsCSFEvidence(text: String, captureID: UUID?) async -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }

        if let captureID {
            let record = captures.first(where: { $0.id == captureID })
                ?? localCaptures.first(where: { $0.id == captureID })?.asCaptureRecord()
            if let record {
                let ok = await promote(record, to: .evidence)
                if ok { lastMessage = "Saved as CSF evidence — open CSF to review." }
                return ok
            }
        }

        let local = LocalCapture(
            id: UUID(),
            text: trimmed,
            intention: .csf,
            createdAt: Date(),
            state: .promoted,
            route: .evidence,
            promotedAt: Date(),
            lastError: nil
        )
        do {
            try await localStore.upsert(local)
            await reloadLocalLedger()
            applyLocalCognition()
            lastMessage = "Saved as CSF evidence — open CSF to review."
            return true
        } catch {
            lastMessage = error.localizedDescription
            return false
        }
    }

    private func localChallengeCorpus(excluding captureID: UUID?) -> [CodexContextRecord] {
        var records = localContextRecords()
        for local in localCaptures {
            // Skip the challenged item while it is still only Inbox raw text.
            // Once promoted to CSF/evidence it becomes a real source.
            if local.id == captureID, local.state == .inbox { continue }
            if local.state == .inbox || local.route == .action || local.route == .project {
                records.append(
                    CodexContextRecord(
                        id: local.id.uuidString,
                        title: String(local.text.prefix(48)),
                        section: local.state == .inbox ? "inbox" : (local.route?.rawValue ?? "related"),
                        excerpt: local.text,
                        provenance: "local"
                    )
                )
            }
        }
        var seen = Set<String>()
        return records.filter { seen.insert($0.id).inserted }
    }

    func sendToFoundry(_ handoff: FoundryHandoff) async -> Bool {
        guard hasRemoteSession else {
            lastMessage = "Foundry handoff needs a linked remote Codex session."
            return false
        }
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

    private func reloadLocalLedger() async {
        localCaptures = await localStore.all()
        // Keep pendingCaptures mirror for Settings until fully retired.
        pendingCaptures = localCaptures
            .filter { $0.state == .inbox }
            .map {
                PendingCapture(
                    id: $0.id,
                    text: $0.text,
                    intention: $0.intention,
                    createdAt: $0.createdAt,
                    lastError: $0.lastError
                )
            }
    }

    private func applyLocalCognition() {
        captures = localCaptures.map { $0.asCaptureRecord() }
        routes = localActionRoutes()
        evidence = localCaptures
            .filter { $0.state == .promoted && $0.route == .evidence }
            .map {
                EvidenceRecord(
                    id: $0.id,
                    routedRequestID: nil,
                    actionID: nil,
                    status: "pending",
                    claim: $0.text,
                    source: "local",
                    observedAt: nil,
                    provenance: "pocketforge-local"
                )
            }
        contextResults = localContextRecords()
        contextSearchAvailable = true
    }

    private func localActionRoutes() -> [RoutedRequestRecord] {
        localCaptures
            .filter { $0.state == .promoted && ($0.route == .action || $0.route == .project || $0.intention == .lar) }
            .map { $0.asLocalRoute() }
    }

    private func localContextRecords() -> [CodexContextRecord] {
        localCaptures
            .filter {
                $0.state == .promoted
                    && [.context, .decision, .evidence, .project].contains($0.route)
            }
            .map { $0.asContextRecord() }
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
        // Also try syncing local inbox items when remote becomes available.
        for local in localCaptures where local.state == .inbox {
            let pending = PendingCapture(
                id: local.id,
                text: local.text,
                intention: local.intention,
                createdAt: local.createdAt,
                lastError: local.lastError
            )
            do {
                _ = try await api.createCapture(pending)
                try await localStore.remove(id: local.id)
            } catch {
                continue
            }
        }
        await reloadLocalLedger()
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

enum LocalCognition {
    static func tinyStep(for intent: String) -> String {
        let trimmed = intent.trimmingCharacters(in: .whitespacesAndNewlines)
        let firstSentence = trimmed.split(whereSeparator: { ".!?\n".contains($0) }).first.map(String.init) ?? trimmed
        let clipped = String(firstSentence.prefix(90))
        if clipped.isEmpty { return "Write the next physical action in one sentence." }
        return "In the next 2 minutes: \(clipped)"
    }

    static func challenge(
        _ input: String,
        against sources: [CodexContextRecord],
        claimCaptureID: UUID? = nil
    ) -> RekAssessment {
        let claimTokens = significantTokens(input)
        let scored = sources.compactMap { source -> (CodexContextRecord, Int)? in
            let score = overlapScore(claimTokens, significantTokens(source.excerpt + " " + source.title))
            guard score > 0 else { return nil }
            return (source, score)
        }
        .sorted { $0.1 > $1.1 }

        let matches = scored.prefix(5).map(\.0)

        if !matches.isEmpty {
            let best = scored[0].1
            let status: RekTruthState = best >= 2 ? .noConflictFound : .possibleConflict
            let summary: String
            if status == .noConflictFound {
                summary = "Matched \(matches.count) on-device record(s) by shared meaning (not exact text). No contradiction inferred — provisional until remote Codex verifies."
            } else {
                summary = "Weak overlap with \(matches.count) local record(s). Treat as a soft lead, not verification."
            }
            return RekAssessment(
                status: status,
                summary: summary,
                sources: matches,
                model: "local-heuristic"
            )
        }

        // No CSF corpus hit — still surface the claim as provisional self-evidence
        // so REK isn't a dead end, and the sheet can offer "Save as CSF evidence".
        let selfSource = CodexContextRecord(
            id: claimCaptureID?.uuidString ?? "claim-self",
            title: "Claim under review",
            section: "self",
            excerpt: input,
            provenance: "local-self"
        )
        return RekAssessment(
            status: .missingEvidence,
            summary: "No related CSF evidence yet. This claim is listed as provisional self-evidence — save it to CSF, or promote a related Inbox item to CSF, then run REK again.",
            sources: [selfSource],
            model: "local-heuristic"
        )
    }

    private static let stopWords: Set<String> = [
        "the", "a", "an", "to", "for", "of", "and", "or", "just", "some", "this", "that",
        "with", "on", "in", "at", "is", "be", "do", "my", "i", "me", "we", "you", "it",
        "from", "into", "about", "then", "than", "as", "by", "not", "are", "was", "were",
    ]

    private static func significantTokens(_ text: String) -> Set<String> {
        Set(
            text.lowercased()
                .split { !$0.isLetter && $0 != "'" }
                .map(String.init)
                .filter { $0.count > 2 && !stopWords.contains($0) }
        )
    }

    private static func overlapScore(_ a: Set<String>, _ b: Set<String>) -> Int {
        a.intersection(b).count
    }
}

private extension CaptureIntention {
    var preferredRoute: CaptureRoute? {
        switch self {
        case .lar: return .action
        case .csf: return .context
        case .inbox, .rek: return nil
        }
    }
}

private func result<T>(_ operation: () async throws -> T) async -> Result<T, Error> {
    do { return .success(try await operation()) }
    catch { return .failure(error) }
}
