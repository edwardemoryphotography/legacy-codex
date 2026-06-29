import SwiftUI

@main
struct PocketForgeApp: App {
    @AppStorage("hasEnteredApp") private var hasEnteredApp = false

    var body: some Scene {
        WindowGroup {
            Group {
                if hasEnteredApp {
                    HomeView()
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                } else {
                    WelcomeView()
                        .transition(.opacity)
                }
            }
            .animation(.spring(duration: 0.5), value: hasEnteredApp)
            .preferredColorScheme(.dark)
            .tint(Theme.accent)
        }
    }
}
