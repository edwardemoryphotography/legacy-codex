import SwiftUI

struct StatusView: View {
    let store: PocketForgeStore
    let router: AppRouter

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                ServiceStateView(phase: store.phase) { Task { await store.refresh() } }
                FocalPointSection(route: store.lar.now) {
                    router.selectedTab = .lar
                }
                ReadinessSection(value: store.readiness) { value in
                    Task { await store.setReadiness(value) }
                }
                StatusCountsSection(
                    inbox: store.unresolvedInboxCount,
                    blocked: store.blockedCount,
                    evidence: store.pendingEvidenceCount
                )
                BuilderBoundarySection()
            }
            .padding(18)
        }
        .background(Theme.background)
        .navigationTitle("STATUS")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    PocketForgeSettingsView(store: store)
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("PocketForge settings")
            }
        }
        .refreshable { await store.refresh() }
    }
}

private struct FocalPointSection: View {
    let route: RoutedRequestRecord?
    let openLAR: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("WHAT MATTERS NOW")
                .technicalType(.caption, weight: .bold)
                .foregroundStyle(Theme.accent)
            Text(route?.intent ?? "No executable route is currently recorded.")
                .font(.system(.title2, design: .rounded, weight: .bold))
                .foregroundStyle(route == nil ? Theme.textSecondary : Theme.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            if let route {
                Text(route.rationale)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                Button("OPEN IN LAR", action: openLAR)
                    .technicalType(.caption, weight: .bold)
                    .buttonStyle(.bordered)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pocketGlass(tint: Theme.accent.opacity(0.07))
        .accessibilityElement(children: .combine)
    }
}

private struct ReadinessSection: View {
    let value: Readiness?
    let select: (Readiness) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("READINESS / ENERGY")
                    .technicalType(.caption, weight: .bold)
                Spacer()
                Text(value?.label.uppercased() ?? "UNSET")
                    .technicalType(.caption, weight: .bold)
                    .foregroundStyle(value == nil ? Theme.textSecondary : Theme.success)
            }
            HStack(spacing: 10) {
                ForEach(Readiness.allCases) { option in
                    Button(option.label) { select(option) }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .buttonStyle(.bordered)
                        .tint(value == option ? Theme.accent : Theme.textSecondary)
                        .accessibilityValue(value == option ? "Selected" : "Not selected")
                }
            }
        }
        .padding(16)
        .cardStyle()
    }
}

private struct StatusCountsSection: View {
    let inbox: Int
    let blocked: Int
    let evidence: Int

    var body: some View {
        HStack(spacing: 10) {
            StatusCount(label: "INBOX", value: inbox, color: Theme.accent)
            StatusCount(label: "BLOCKED", value: blocked, color: Theme.danger)
            StatusCount(label: "EVIDENCE", value: evidence, color: Theme.warning)
        }
    }
}

private struct StatusCount: View {
    let label: String
    let value: Int
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(String(value)).technicalType(.title2, weight: .bold).foregroundStyle(color)
            Text(label).technicalType(.caption2, weight: .bold).foregroundStyle(Theme.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label), \(value)")
    }
}

private struct BuilderBoundarySection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("FOUNDRY CAPABILITY")
                .technicalType(.caption, weight: .bold)
                .foregroundStyle(Theme.foundry)
            Text("The original AI app builder is preserved as technical execution infrastructure.")
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
            NavigationLink("OPEN LEGACY BUILDER") { HomeView() }
                .technicalType(.caption, weight: .bold)
        }
        .padding(16)
        .cardStyle()
    }
}

struct PocketForgeSettingsView: View {
    let store: PocketForgeStore

    var body: some View {
        List {
            Section("Owner") {
                LabeledContent("Unlock", value: "Face ID on this iPhone")
                LabeledContent("Session", value: store.ownerEmail ?? "Local owner")
                Button("Lock & Reset Face ID", role: .destructive) { Task { await store.signOut() } }
            }
            Section("Services") {
                LabeledContent(
                    "Remote Codex",
                    value: store.hasRemoteSession ? "Linked" : "Local-only"
                )
                LabeledContent("Codex API", value: AppConfig.codexBaseURL.host ?? "—")
                LabeledContent("Pending captures", value: String(store.pendingCaptures.count))
            }
        }
        .navigationTitle("SETTINGS")
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
    }
}
