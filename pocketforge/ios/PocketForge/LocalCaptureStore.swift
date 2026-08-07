import Foundation

/// On-device cognition ledger used when remote Codex is not linked.
/// Migrates the older `pending-captures.json` queue into a full local inbox
/// with promote / archive / dismiss so thoughts don't pile up forever.
actor LocalCaptureStore {
    static let shared = LocalCaptureStore()

    private let fileURL: URL
    private let legacyURL: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let fileManager: FileManager

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
        let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = support.appendingPathComponent("PocketForge", isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("local-captures.json")
        legacyURL = directory.appendingPathComponent("pending-captures.json")
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    func all() -> [LocalCapture] {
        migrateLegacyIfNeeded()
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        return ((try? decoder.decode([LocalCapture].self, from: data)) ?? [])
            .sorted { $0.createdAt > $1.createdAt }
    }

    func inbox() -> [LocalCapture] {
        all().filter { $0.state == .inbox }
    }

    func upsert(_ capture: LocalCapture) throws {
        var captures = all()
        if let index = captures.firstIndex(where: { $0.id == capture.id }) {
            captures[index] = capture
        } else {
            captures.insert(capture, at: 0)
        }
        try persist(captures)
    }

    func remove(id: UUID) throws {
        try persist(all().filter { $0.id != id })
    }

    func promote(id: UUID, route: CaptureRoute) throws -> LocalCapture? {
        var captures = all()
        guard let index = captures.firstIndex(where: { $0.id == id }) else { return nil }
        captures[index].state = route == .archive ? .archived : .promoted
        captures[index].route = route
        captures[index].promotedAt = Date()
        captures[index].lastError = nil
        try persist(captures)
        return captures[index]
    }

    private func migrateLegacyIfNeeded() {
        guard !fileManager.fileExists(atPath: fileURL.path),
              fileManager.fileExists(atPath: legacyURL.path),
              let data = try? Data(contentsOf: legacyURL),
              let legacy = try? decoder.decode([PendingCapture].self, from: data)
        else { return }

        let migrated = legacy.map { pending in
            LocalCapture(
                id: pending.id,
                text: pending.text,
                intention: pending.intention,
                createdAt: pending.createdAt,
                state: .inbox,
                route: nil,
                promotedAt: nil,
                lastError: pending.lastError
            )
        }
        try? persist(migrated)
        try? fileManager.removeItem(at: legacyURL)
    }

    private func persist(_ captures: [LocalCapture]) throws {
        let data = try encoder.encode(captures)
        try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
    }
}

struct LocalCapture: Codable, Identifiable, Hashable {
    let id: UUID
    var text: String
    var intention: CaptureIntention
    var createdAt: Date
    var state: CaptureState
    var route: CaptureRoute?
    var promotedAt: Date?
    var lastError: String?

    func asCaptureRecord() -> CaptureRecord {
        let formatter = ISO8601DateFormatter()
        return CaptureRecord(
            id: id,
            userID: LocalCapture.localUserID,
            text: text,
            tags: ["intention:\(intention.rawValue)", "source:local"],
            state: state,
            route: route,
            createdAt: formatter.string(from: createdAt),
            updatedAt: formatter.string(from: promotedAt ?? createdAt),
            promotedAt: promotedAt.map(formatter.string(from:)),
            idempotencyKey: id
        )
    }

    func asLocalRoute() -> RoutedRequestRecord {
        RoutedRequestRecord(
            id: id,
            workspaceID: LocalCapture.localWorkspaceID,
            actionID: nil,
            intent: text,
            taskType: route == .project ? "build" : "action",
            executionLane: "local",
            selectedAgent: "owner",
            repository: "local",
            repositoryPath: nil,
            risk: "low",
            sensitivity: "private",
            requiredEvidence: "Confirm the next physical step on this iPhone.",
            rationale: "Promoted locally as \(route?.label ?? "Action").",
            confidence: 80,
            status: "queued",
            provenance: "pocketforge-local",
            createdAt: ISO8601DateFormatter().string(from: promotedAt ?? createdAt)
        )
    }

    func asContextRecord() -> CodexContextRecord {
        CodexContextRecord(
            id: id.uuidString,
            title: String(text.prefix(48)),
            section: route?.rawValue ?? intention.rawValue,
            excerpt: text,
            provenance: "local"
        )
    }

    static let localUserID = UUID(uuidString: "00000000-0000-4000-8000-000000000001")!
    static let localWorkspaceID = UUID(uuidString: "00000000-0000-4000-8000-000000000002")!
}
