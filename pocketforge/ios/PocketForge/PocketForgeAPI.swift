import Foundation

struct OwnerSession: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: TimeInterval
    let userID: UUID
    let email: String

    var needsRefresh: Bool { Date().timeIntervalSince1970 >= expiresAt - 60 }
}

enum PocketForgeAPIError: LocalizedError {
    case notConfigured
    case authenticationRequired
    case invalidResponse
    case server(status: Int, message: String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: "Working locally on this iPhone."
        case .authenticationRequired: "Remote Codex session unavailable."
        case .invalidResponse: "The service returned an unreadable response."
        case .server(_, let message): message
        case .transport(let message): message
        }
    }

    var canQueueCapture: Bool {
        switch self {
        case .authenticationRequired, .transport: true
        case .server(let status, _): status >= 500
        default: false
        }
    }
}

actor PocketForgeAPI {
    static let shared = PocketForgeAPI()

    private let sessionClient: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private(set) var ownerSession: OwnerSession?

    init(sessionClient: URLSession = .shared) {
        self.sessionClient = sessionClient
        if let data = KeychainStore.load() {
            ownerSession = try? decoder.decode(OwnerSession.self, from: data)
        }
    }

    var isAuthenticated: Bool { ownerSession != nil }
    var ownerEmail: String? { ownerSession?.email }

    func signIn(email: String, password: String) async throws {
        guard let baseURL = AppConfig.supabaseURL, let anonKey = AppConfig.supabaseAnonKey else {
            throw PocketForgeAPIError.notConfigured
        }
        var components = URLComponents(url: baseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(["email": email, "password": password])
        let response: AuthResponse = try await perform(request)
        let session = response.ownerSession
        try persist(session)
        ownerSession = session
    }

    func signOut() {
        ownerSession = nil
        KeychainStore.remove()
    }

    func captures() async throws -> [CaptureRecord] {
        try await rest(
            path: "nd_captures",
            query: [
                .init(name: "select", value: "id,user_id,text,tags,state,route,created_at,updated_at,promoted_at,idempotency_key"),
                .init(name: "order", value: "created_at.desc"),
                .init(name: "limit", value: "100"),
            ]
        )
    }

    func createCapture(_ capture: PendingCapture) async throws -> CaptureRecord {
        guard let userID = ownerSession?.userID else { throw PocketForgeAPIError.authenticationRequired }
        let body = CaptureInsert(
            id: capture.id,
            userID: userID,
            text: capture.text,
            tags: ["intention:\(capture.intention.rawValue)"],
            state: .inbox,
            idempotencyKey: capture.id,
            createdAt: ISO8601DateFormatter().string(from: capture.createdAt)
        )
        let records: [CaptureRecord] = try await rest(
            path: "nd_captures",
            method: "POST",
            query: [.init(name: "on_conflict", value: "id")],
            body: body,
            prefer: "resolution=merge-duplicates,return=representation"
        )
        guard let record = records.first else { throw PocketForgeAPIError.invalidResponse }
        return record
    }

    func promoteCapture(id: UUID, route: CaptureRoute) async throws -> CaptureRecord {
        let response: CaptureRecord = try await rpc(
            name: "promote_capture",
            body: PromoteCaptureRequest(captureID: id, route: route)
        )
        return response
    }

    func readiness() async throws -> ReadinessRecord? {
        guard let userID = ownerSession?.userID else { throw PocketForgeAPIError.authenticationRequired }
        let values: [ReadinessRecord] = try await rest(
            path: "nd_prefs",
            query: [
                .init(name: "select", value: "readiness,readiness_updated_at"),
                .init(name: "user_id", value: "eq.\(userID.uuidString.lowercased())"),
                .init(name: "limit", value: "1"),
            ]
        )
        return values.first
    }

    func setReadiness(_ readiness: Readiness) async throws -> ReadinessRecord {
        try await rpc(name: "set_pocketforge_readiness", body: ["p_readiness": readiness.rawValue])
    }

    func workspaces() async throws -> [WorkspaceRecord] {
        try await rest(path: "workspaces", query: [
            .init(name: "select", value: "id,name,created_at"),
            .init(name: "order", value: "created_at.asc"),
        ])
    }

    func routes() async throws -> [RoutedRequestRecord] {
        try await rest(path: "routed_requests", query: [
            .init(name: "select", value: "id,workspace_id,action_id,intent,task_type,execution_lane,selected_agent,repository,repository_path,risk,sensitivity,required_evidence,rationale,confidence,status,provenance,created_at"),
            .init(name: "order", value: "created_at.desc"),
            .init(name: "limit", value: "100"),
        ])
    }

    func evidence() async throws -> [EvidenceRecord] {
        try await rest(path: "evidence_items", query: [
            .init(name: "select", value: "id,routed_request_id,action_id,status,claim,source,observed_at,provenance"),
            .init(name: "order", value: "created_at.desc"),
            .init(name: "limit", value: "150"),
        ])
    }

    func searchContext(_ query: String) async throws -> [CodexContextRecord] {
        let response: ContextResponse = try await codex(
            path: "api/pocketforge/context",
            method: "GET",
            query: [.init(name: "q", value: query)]
        )
        return response.results
    }

    func tinyStep(for input: String) async throws -> String {
        let response: TinyStepResponse = try await codex(
            path: "api/pocketforge/cognition",
            method: "POST",
            body: CognitionRequest(mode: "tiny_step", input: input)
        )
        return response.text
    }

    func challenge(_ input: String) async throws -> RekAssessment {
        try await codex(
            path: "api/pocketforge/cognition",
            method: "POST",
            body: CognitionRequest(mode: "rek", input: input)
        )
    }

    func sendToFoundry(_ handoff: FoundryHandoff) async throws {
        guard let workspaceID = handoff.workspaceID else {
            throw PocketForgeAPIError.server(status: 400, message: "Choose a real workspace.")
        }
        let proposal = RouteProposal(
            workspaceID: workspaceID,
            idempotencyKey: handoff.capture.id,
            intent: handoff.capture.text,
            taskType: handoff.taskType,
            executionLane: "execution",
            selectedAgent: "foundry",
            repository: handoff.repository,
            repositoryPath: handoff.repositoryPath.isEmpty ? nil : handoff.repositoryPath,
            risk: handoff.risk,
            sensitivity: handoff.sensitivity,
            requiredEvidence: handoff.requiredEvidence,
            rationale: "Owner-confirmed PocketForge handoff",
            confidence: 100,
            routeSource: "user",
            evidenceKind: "custom"
        )
        let _: RouteRPCResponse = try await rpc(name: "persist_route_owner", body: ["p_proposal": proposal])
    }

    private func persist(_ session: OwnerSession) throws {
        try KeychainStore.save(encoder.encode(session))
    }

    private func refreshIfNeeded() async throws -> OwnerSession {
        guard let current = ownerSession else { throw PocketForgeAPIError.authenticationRequired }
        guard current.needsRefresh else { return current }
        guard let baseURL = AppConfig.supabaseURL, let anonKey = AppConfig.supabaseAnonKey else {
            throw PocketForgeAPIError.notConfigured
        }
        var components = URLComponents(url: baseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [.init(name: "grant_type", value: "refresh_token")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(["refresh_token": current.refreshToken])
        let response: AuthResponse = try await perform(request)
        let refreshed = response.ownerSession
        try persist(refreshed)
        ownerSession = refreshed
        return refreshed
    }

    private func rest<Response: Decodable>(
        path: String,
        method: String = "GET",
        query: [URLQueryItem] = [],
        body: (some Encodable)? = Optional<String>.none,
        prefer: String? = nil
    ) async throws -> Response {
        guard let baseURL = AppConfig.supabaseURL, let anonKey = AppConfig.supabaseAnonKey else {
            throw PocketForgeAPIError.notConfigured
        }
        let session = try await refreshIfNeeded()
        var components = URLComponents(url: baseURL.appendingPathComponent("rest/v1/\(path)"), resolvingAgainstBaseURL: false)!
        components.queryItems = query.isEmpty ? nil : query
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let prefer { request.setValue(prefer, forHTTPHeaderField: "Prefer") }
        if let body { request.httpBody = try encoder.encode(body) }
        return try await perform(request)
    }

    private func rpc<Response: Decodable, Body: Encodable>(name: String, body: Body) async throws -> Response {
        try await rest(path: "rpc/\(name)", method: "POST", body: body)
    }

    private func codex<Response: Decodable>(
        path: String,
        method: String,
        query: [URLQueryItem] = [],
        body: (some Encodable)? = Optional<String>.none
    ) async throws -> Response {
        let session = try await refreshIfNeeded()
        var components = URLComponents(url: AppConfig.codexBaseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        components.queryItems = query.isEmpty ? nil : query
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body { request.httpBody = try encoder.encode(body) }
        return try await perform(request)
    }

    private func perform<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        do {
            let (data, response) = try await sessionClient.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw PocketForgeAPIError.invalidResponse }
            guard (200..<300).contains(http.statusCode) else {
                let error = try? decoder.decode(ServiceError.self, from: data)
                if http.statusCode == 401 { throw PocketForgeAPIError.authenticationRequired }
                throw PocketForgeAPIError.server(
                    status: http.statusCode,
                    message: error?.error ?? error?.message ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
                )
            }
            return try decoder.decode(Response.self, from: data)
        } catch let error as PocketForgeAPIError {
            throw error
        } catch let error as DecodingError {
            throw PocketForgeAPIError.server(status: 500, message: "Response contract mismatch: \(error.localizedDescription)")
        } catch {
            throw PocketForgeAPIError.transport(error.localizedDescription)
        }
    }
}

private struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: TimeInterval
    let user: AuthUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case user
    }

    var ownerSession: OwnerSession {
        OwnerSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: Date().timeIntervalSince1970 + expiresIn,
            userID: user.id,
            email: user.email
        )
    }
}

private struct AuthUser: Decodable { let id: UUID; let email: String }
private struct ServiceError: Decodable { let error: String?; let message: String? }
private struct CaptureInsert: Encodable {
    let id: UUID
    let userID: UUID
    let text: String
    let tags: [String]
    let state: CaptureState
    let idempotencyKey: UUID
    let createdAt: String
    enum CodingKeys: String, CodingKey {
        case id, text, tags, state
        case userID = "user_id"
        case idempotencyKey = "idempotency_key"
        case createdAt = "created_at"
    }
}
private struct PromoteCaptureRequest: Encodable {
    let captureID: UUID
    let route: CaptureRoute
    enum CodingKeys: String, CodingKey { case captureID = "p_capture_id"; case route = "p_route" }
}
private struct ContextResponse: Decodable { let results: [CodexContextRecord] }
private struct TinyStepResponse: Decodable { let text: String }
private struct CognitionRequest: Encodable { let mode: String; let input: String }
private struct RouteRPCResponse: Decodable { let eventLogged: Bool; let replayed: Bool }
private struct RouteProposal: Encodable {
    let workspaceID: UUID
    let idempotencyKey: UUID
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
    let confidence: Int
    let routeSource: String
    let evidenceKind: String
    enum CodingKeys: String, CodingKey {
        case intent, repository, risk, sensitivity, rationale, confidence
        case workspaceID = "workspace_id"
        case idempotencyKey = "idempotency_key"
        case taskType = "task_type"
        case executionLane = "execution_lane"
        case selectedAgent = "selected_agent"
        case repositoryPath = "repository_path"
        case requiredEvidence = "required_evidence"
        case routeSource = "route_source"
        case evidenceKind = "evidence_kind"
    }
}
