import AppIntents
import Foundation

struct CaptureThoughtIntent: AppIntent {
    static let title: LocalizedStringResource = "Capture Thought"
    static let description = IntentDescription("Capture a thought into the PocketForge Inbox without classifying it.")
    static let openAppWhenRun = false

    @Parameter(title: "Thought")
    var thought: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let text = thought.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return .result(dialog: "No thought was provided.") }

        let pending = PendingCapture(
            id: UUID(),
            text: text,
            intention: .inbox,
            createdAt: Date(),
            lastError: nil
        )
        let api = PocketForgeAPI.shared
        if await api.isAuthenticated {
            do {
                _ = try await api.createCapture(pending)
                return .result(dialog: "Captured in the PocketForge Inbox.")
            } catch let error as PocketForgeAPIError where error.canQueueCapture {
                try? await PendingCaptureStore.shared.enqueue(pending)
                return .result(dialog: "Saved on this iPhone. It has not reached Codex yet.")
            } catch {
                return .result(dialog: "Capture failed. \(error.localizedDescription)")
            }
        }

        try? await PendingCaptureStore.shared.enqueue(pending)
        return .result(dialog: "Saved on this iPhone.")
    }
}

struct WhatsMyNextActionIntent: AppIntent {
    static let title: LocalizedStringResource = "What's My Next Action?"
    static let description = IntentDescription("Return the current executable LAR action from real Codex state.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = PocketForgeAPI.shared
        guard await api.isAuthenticated else {
            return .result(dialog: "No remote Codex session on this iPhone yet.")
        }
        do {
            async let routes = api.routes()
            async let evidence = api.evidence()
            let state = CognitionDeriver.lar(routes: try await routes, evidence: try await evidence)
            if let current = state.now {
                return .result(dialog: IntentDialog(stringLiteral: current.intent))
            }
            return .result(dialog: "No executable action is currently recorded.")
        } catch {
            return .result(dialog: "Unable to verify the next action. \(error.localizedDescription)")
        }
    }
}

struct OpenInboxIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Inbox"
    static let description = IntentDescription("Open PocketForge directly to Inbox.")
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        IntentHandoff.stage(URL(string: "pocketforge://inbox")!)
        return .result()
    }
}

struct PocketForgeShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CaptureThoughtIntent(),
            phrases: [
                "Capture this in \(.applicationName)",
                "Add this to my Codex with \(.applicationName)",
                "Capture a thought in \(.applicationName)",
            ],
            shortTitle: "Capture Thought",
            systemImageName: "text.badge.plus"
        )
        AppShortcut(
            intent: WhatsMyNextActionIntent(),
            phrases: [
                "What's my next action in \(.applicationName)",
                "What do I do next with \(.applicationName)",
            ],
            shortTitle: "Next Action",
            systemImageName: "bolt.fill"
        )
        AppShortcut(
            intent: OpenInboxIntent(),
            phrases: ["Open my Inbox in \(.applicationName)"],
            shortTitle: "Open Inbox",
            systemImageName: "tray.fill"
        )
    }

    static var shortcutTileColor: ShortcutTileColor { .teal }
}
