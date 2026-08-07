import Foundation

enum AppTab: String, CaseIterable, Identifiable, Codable {
    case status
    case inbox
    case lar
    case csf

    var id: String { rawValue }
    var title: String { rawValue.uppercased() }

    var symbol: String {
        switch self {
        case .status: "scope"
        case .inbox: "tray"
        case .lar: "bolt"
        case .csf: "brain.head.profile"
        }
    }
}

enum CaptureRoute: String, Codable, CaseIterable, Identifiable {
    case action
    case context
    case decision
    case evidence
    case project
    case archive
    case foundryRequest = "foundry_request"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .foundryRequest: "Foundry Request"
        default: rawValue.capitalized
        }
    }
}

enum CaptureIntention: String, Codable, CaseIterable, Identifiable {
    case inbox
    case lar
    case csf
    case rek

    var id: String { rawValue }
    var label: String { rawValue.uppercased() }
    var symbol: String {
        switch self {
        case .inbox: "tray"
        case .lar: "bolt"
        case .csf: "brain.head.profile"
        case .rek: "shield.lefthalf.filled"
        }
    }
}

enum CaptureState: String, Codable {
    case inbox
    case promoted
    case archived
}

struct CaptureRecord: Codable, Identifiable, Hashable {
    let id: UUID
    let userID: UUID
    let text: String
    let tags: [String]
    let state: CaptureState
    let route: CaptureRoute?
    let createdAt: String
    let updatedAt: String?
    let promotedAt: String?
    let idempotencyKey: UUID

    enum CodingKeys: String, CodingKey {
        case id, text, tags, state, route
        case userID = "user_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case promotedAt = "promoted_at"
        case idempotencyKey = "idempotency_key"
    }
}

struct PendingCapture: Codable, Identifiable, Hashable {
    let id: UUID
    let text: String
    let intention: CaptureIntention
    let createdAt: Date
    var lastError: String?
}

enum Readiness: String, Codable, CaseIterable, Identifiable {
    case low
    case medium
    case high

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

struct ReadinessRecord: Decodable {
    let readiness: Readiness?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case readiness
        case updatedAt = "readiness_updated_at"
    }
}

struct WorkspaceRecord: Decodable, Identifiable, Hashable {
    let id: UUID
    let name: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, name
        case createdAt = "created_at"
    }
}

struct RoutedRequestRecord: Decodable, Identifiable, Hashable {
    let id: UUID
    let workspaceID: UUID
    let actionID: UUID?
    let intent: String
    let taskType: String
    let executionLane: String
    let selectedAgent: String
    let repository: String
    let repositoryPath: String?
    let risk: String
    let sensitivity: String
    let requiredEvidence: String
    let rationale: String
    let confidence: Double
    let status: String
    let provenance: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, intent, repository, risk, sensitivity, rationale, confidence, status, provenance
        case workspaceID = "workspace_id"
        case actionID = "action_id"
        case taskType = "task_type"
        case executionLane = "execution_lane"
        case selectedAgent = "selected_agent"
        case repositoryPath = "repository_path"
        case requiredEvidence = "required_evidence"
        case createdAt = "created_at"
    }

    var isLive: Bool { status != "superseded" && status != "rejected" }
    var isBlocked: Bool { status == "blocked_policy" }
}

struct EvidenceRecord: Decodable, Identifiable, Hashable {
    let id: UUID
    let routedRequestID: UUID?
    let actionID: UUID?
    let status: String
    let claim: String
    let source: String?
    let observedAt: String?
    let provenance: String

    enum CodingKeys: String, CodingKey {
        case id, status, claim, source, provenance
        case routedRequestID = "routed_request_id"
        case actionID = "action_id"
        case observedAt = "observed_at"
    }
}

struct CodexContextRecord: Decodable, Identifiable, Hashable {
    let id: String
    let title: String
    let section: String
    let excerpt: String
    let provenance: String
}

enum RekTruthState: String, Decodable {
    case verifiedConflict = "verified_conflict"
    case possibleConflict = "possible_conflict"
    case missingEvidence = "missing_evidence"
    case noConflictFound = "no_conflict_found"
    case unableToVerify = "unable_to_verify"

    var label: String { rawValue.replacingOccurrences(of: "_", with: " ").uppercased() }
}

struct RekAssessment: Decodable, Hashable {
    let status: RekTruthState
    let summary: String
    let sources: [CodexContextRecord]
    let model: String?
}

struct FoundryHandoff: Hashable {
    let capture: CaptureRecord
    var workspaceID: UUID?
    var repository = ""
    var repositoryPath = ""
    var taskType = "implementation"
    var requiredEvidence = ""
    var risk = "medium"
    var sensitivity = "private"
}

struct LARState: Equatable {
    let now: RoutedRequestRecord?
    let next: [RoutedRequestRecord]
    let blocked: [RoutedRequestRecord]
    let nextPhysicalTarget: String?
}

enum CognitionDeriver {
    static func lar(routes: [RoutedRequestRecord], evidence: [EvidenceRecord]) -> LARState {
        let live = routes.filter(\.isLive).sorted { $0.createdAt > $1.createdAt }
        let blocked = live.filter(\.isBlocked)
        let executable = live.filter { !$0.isBlocked }
        let now = executable.first
        let queued = Array(executable.dropFirst().prefix(4))
        let target: String?
        if let now {
            let items = evidence.filter { $0.routedRequestID == now.id }
            let verified = !items.isEmpty && items.allSatisfy {
                $0.status == "verified" && $0.source != nil && $0.observedAt != nil
            }
            target = verified ? nil : now.requiredEvidence
        } else {
            target = nil
        }
        return LARState(now: now, next: queued, blocked: blocked, nextPhysicalTarget: target)
    }
}
