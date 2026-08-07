import SwiftUI

struct PocketForgeRootView: View {
    let store: PocketForgeStore
    let router: AppRouter

    var body: some View {
        @Bindable var router = router

        ZStack {
            Theme.background.ignoresSafeArea()

            if store.isAuthenticated {
                TabView(selection: $router.selectedTab) {
                    tab(.status) { StatusView(store: store, router: router) }
                    tab(.inbox) { InboxView(store: store, router: router) }
                    tab(.lar) { LARView(store: store, router: router) }
                    tab(.csf) { CSFView(store: store, router: router) }
                }
                .toolbarBackground(Theme.surface.opacity(0.92), for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
                .overlay(alignment: .bottomTrailing) {
                    if router.selectedTab != .status {
                        GlobalCaptureButton { router.sheet = .capture(.inbox) }
                            .padding(.trailing, 18)
                            .padding(.bottom, 70)
                    }
                }
            } else {
                OwnerSignInView(store: store)
            }
        }
        .sheet(item: $router.sheet) { sheet in
            switch sheet {
            case .capture(let intention):
                CaptureSheet(store: store, router: router, initialIntention: intention)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            case .rek(let text, let captureID):
                REKSheet(store: store, input: text, captureID: captureID) {
                    router.selectedTab = .csf
                }
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            case .foundry(let capture):
                FoundryHandoffSheet(store: store, capture: capture)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
        }
        .overlay(alignment: .top) {
            if let message = store.lastMessage {
                TruthBanner(message: message) { store.lastMessage = nil }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
            }
        }
    }

    private func tab<Content: View>(_ tab: AppTab, @ViewBuilder content: () -> Content) -> some View {
        NavigationStack { content() }
            .tabItem { Label(tab.title, systemImage: tab.symbol) }
            .tag(tab)
    }
}

private struct GlobalCaptureButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.system(size: 20, weight: .bold))
                .frame(width: 54, height: 54)
                .foregroundStyle(Theme.background)
                .background(Theme.heroGradient, in: Circle())
                .shadow(color: Theme.accent.opacity(0.4), radius: 18, y: 8)
        }
        .accessibilityLabel("Capture a thought")
        .accessibilityHint("Opens PocketForge capture from any tab")
    }
}

struct TruthBanner: View {
    let message: String
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Text(message)
                .technicalType(.footnote)
                .foregroundStyle(Theme.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: dismiss) {
                Image(systemName: "xmark")
                    .frame(width: 32, height: 32)
            }
            .accessibilityLabel("Dismiss")
        }
        .padding(12)
        .pocketGlass()
    }
}

struct ServiceStateView: View {
    let phase: DataPhase
    let retry: () -> Void

    var body: some View {
        switch phase {
        case .loading:
            ProgressView("UNLOCKED")
                .technicalType(.caption, weight: .semibold)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .localReady:
            VStack(alignment: .leading, spacing: 8) {
                Label("READY", systemImage: "checkmark.shield")
                    .technicalType(.caption, weight: .bold)
                    .foregroundStyle(Theme.success)
                Text("Unlocked on this iPhone. Inbox, LAR, and CSF work locally — remote Codex is optional.")
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
            }
            .padding(14)
            .cardStyle()
        case .partial(let message), .failed(let message):
            VStack(alignment: .leading, spacing: 8) {
                Label("PARTIAL / UNAVAILABLE", systemImage: "exclamationmark.triangle")
                    .technicalType(.caption, weight: .bold)
                    .foregroundStyle(Theme.warning)
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                Button("Retry", action: retry)
                    .buttonStyle(.bordered)
            }
            .padding(14)
            .cardStyle()
        default:
            EmptyView()
        }
    }
}
