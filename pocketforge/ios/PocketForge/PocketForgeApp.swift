import SwiftUI

@main
struct PocketForgeApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var store = PocketForgeStore()
    @State private var router = AppRouter()

    var body: some Scene {
        WindowGroup {
            PocketForgeRootView(store: store, router: router)
                .task { await store.start() }
                .onOpenURL { url in
                    router.handle(url)
                }
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .active:
                        router.consumeIntentHandoff()
                        Task {
                            if store.isOwnerEnrolled && !store.isAuthenticated {
                                await store.unlockWithFaceID()
                            } else {
                                await store.refresh()
                            }
                        }
                    case .background:
                        Task { await store.lock() }
                    default:
                        break
                    }
                }
            .preferredColorScheme(.dark)
            .tint(Theme.accent)
        }
    }
}
