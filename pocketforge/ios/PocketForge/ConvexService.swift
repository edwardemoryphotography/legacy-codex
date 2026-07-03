import Combine
import ConvexMobile
import Foundation

/// Single gateway to the Convex backend. Queries arrive as live Combine
/// publishers (the UI updates in real time as the agent works); mutations
/// and actions are async calls.
final class ConvexService: ObservableObject {
    static let shared = ConvexService()

    let client: ConvexClient

    @Published private(set) var projects: [Project] = []

    private var cancellables = Set<AnyCancellable>()

    private init() {
        client = ConvexClient(deploymentUrl: AppConfig.convexDeploymentURL)

        client.subscribe(to: "projects:list", yielding: [Project].self)
            .replaceError(with: [])
            .receive(on: DispatchQueue.main)
            .sink { [weak self] projects in
                self?.projects = projects
            }
            .store(in: &cancellables)
    }

    // MARK: - Live subscriptions

    func projectPublisher(projectId: String) -> AnyPublisher<Project?, Never> {
        client.subscribe(
            to: "projects:get",
            with: ["projectId": projectId],
            yielding: Project?.self
        )
        .replaceError(with: nil)
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()
    }

    func messagesPublisher(projectId: String) -> AnyPublisher<[Message], Never> {
        client.subscribe(
            to: "messages:list",
            with: ["projectId": projectId],
            yielding: [Message].self
        )
        .replaceError(with: [])
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()
    }

    func filesPublisher(projectId: String) -> AnyPublisher<[ProjectFile], Never> {
        client.subscribe(
            to: "files:list",
            with: ["projectId": projectId],
            yielding: [ProjectFile].self
        )
        .replaceError(with: [])
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()
    }

    // MARK: - Commands

    /// Creates the project row and returns its id. The build itself is
    /// kicked off separately so the UI can navigate immediately.
    func createProject(name: String, prompt: String, icon: String) async throws -> String {
        try await client.mutation(
            "projects:create",
            with: ["name": name, "prompt": prompt, "icon": icon]
        )
    }

    /// Runs the agent: generates code with Claude, deploys it to the
    /// Daytona sandbox, and updates the project. Long-running — callers
    /// should fire this in a background Task and let the subscriptions
    /// drive the UI.
    func build(projectId: String, prompt: String) async throws {
        try await client.action(
            "agent:build",
            with: ["projectId": projectId, "prompt": prompt]
        )
    }

    /// Makes sure a live project's sandbox is awake and its preview URL is
    /// fresh. Safe to call every time a workspace opens.
    func wake(projectId: String) async {
        try? await client.action("agent:wake", with: ["projectId": projectId])
    }

    /// Deletes the sandbox and all project data.
    func destroy(projectId: String) async throws {
        try await client.action("agent:destroy", with: ["projectId": projectId])
    }
}
