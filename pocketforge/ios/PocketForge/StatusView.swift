import SwiftUI

struct StatusView: View {
    let store: PocketForgeStore
    let router: AppRouter

    var body: some View {
        ForgeHomeView(store: store)
    }
}

struct PocketForgeSettingsView: View {
    let store: PocketForgeStore

    var body: some View {
        List {
            Section("Owner") {
                LabeledContent("Unlock", value: "Face ID on this iPhone")
                LabeledContent("Session", value: store.ownerEmail ?? "Local owner")
                Button("Lock & Reset Face ID", role: .destructive) {
                    Task { await store.signOut() }
                }
            }
            Section("Studio") {
                NavigationLink("Codex cockpit") {
                    CodexCockpitView(store: store)
                }
                LabeledContent(
                    "Remote Codex",
                    value: store.hasRemoteSession ? "Linked" : "Local-only"
                )
                LabeledContent("Pending captures", value: String(store.pendingCaptures.count))
            }
            Section("Builder") {
                NavigationLink("All apps (list)") {
                    HomeView()
                }
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
    }
}

/// Former Status surfaces — kept for power users under Settings.
struct CodexCockpitView: View {
    let store: PocketForgeStore

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                ServiceStateView(phase: store.phase) { Task { await store.refresh() } }
                cockpitSection(
                    title: "What matters now",
                    body: store.lar.now?.intent ?? "No executable route is currently recorded."
                )
                HStack(spacing: 10) {
                    cockpitStat("Inbox", store.unresolvedInboxCount, Theme.accent)
                    cockpitStat("Blocked", store.blockedCount, Theme.danger)
                    cockpitStat("Evidence", store.pendingEvidenceCount, Theme.warning)
                }
            }
            .padding(18)
        }
        .background(ForgeStageBackground(intensity: 0.45))
        .navigationTitle("Codex")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store.refresh() }
    }

    private func cockpitSection(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(Theme.uiFont(.caption, weight: .bold))
                .foregroundStyle(Theme.accent)
            Text(body)
                .font(Theme.displayFont(24, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pocketGlass(tint: Theme.accent.opacity(0.08))
    }

    private func cockpitStat(_ label: String, _ value: Int, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(String(value))
                .font(Theme.uiFont(.title2, weight: .bold))
                .foregroundStyle(color)
            Text(label.uppercased())
                .font(Theme.uiFont(.caption2, weight: .bold))
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }
}
