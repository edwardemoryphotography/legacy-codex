import SwiftUI

struct LARView: View {
    let store: PocketForgeStore
    let router: AppRouter

    @State private var tinySteps: [UUID: String] = [:]
    @State private var loadingTinyStep: UUID?

    private var promotedActions: [CaptureRecord] {
        store.promotedCaptures.filter { $0.route == .action || $0.route == .project }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                if !store.hasRemoteSession {
                    LocalModeBanner(
                        title: "LAR on this iPhone",
                        detail: "Promote Inbox items to Action to fill NOW / NEXT. Tiny Step works offline."
                    )
                }

                LARSectionLabel(title: "NOW", color: Theme.accent)
                if let route = store.lar.now {
                    ExecutableRouteCard(
                        route: route,
                        tinyStep: tinySteps[route.id],
                        isLoading: loadingTinyStep == route.id,
                        requestTinyStep: { requestTinyStep(route) },
                        challenge: { router.sheet = .rek(text: route.intent, captureID: route.id) },
                        done: {
                            Task {
                                if let capture = store.captures.first(where: { $0.id == route.id }) {
                                    await store.dismiss(capture)
                                }
                            }
                        }
                    )
                } else {
                    EmptyActionCard(
                        text: "Nothing executable yet.",
                        primary: "Capture for LAR",
                        secondary: "Open Inbox"
                    ) {
                        router.sheet = .capture(.lar)
                    } secondaryAction: {
                        router.selectedTab = .inbox
                    }
                }

                LARSectionLabel(title: "NEXT", color: Theme.purple)
                if store.lar.next.isEmpty {
                    HonestEmptyState(text: "No queued actions. Promote more Inbox items to LAR.")
                } else {
                    ForEach(store.lar.next) { route in
                        CompactRouteRow(route: route) { router.sheet = .rek(text: route.intent, captureID: route.id) }
                    }
                }

                LARSectionLabel(title: "BLOCKED / WAITING", color: Theme.danger)
                if store.lar.blocked.isEmpty {
                    HonestEmptyState(text: "No blocked routes.")
                } else {
                    ForEach(store.lar.blocked) { route in
                        CompactRouteRow(route: route) { router.sheet = .rek(text: route.intent, captureID: route.id) }
                    }
                }

                if !promotedActions.isEmpty {
                    LARSectionLabel(title: "PROMOTED ON THIS IPHONE", color: Theme.textSecondary)
                    ForEach(promotedActions) { capture in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(capture.route?.label.uppercased() ?? "ACTION")
                                .technicalType(.caption2, weight: .bold)
                                .foregroundStyle(Theme.accent)
                            Text(capture.text).font(.subheadline)
                            HStack {
                                Button("REK") {
                                    router.sheet = .rek(text: capture.text, captureID: capture.id)
                                }
                                .buttonStyle(.bordered)
                                Button("Done") {
                                    Task { await store.dismiss(capture) }
                                }
                                .buttonStyle(.bordered)
                            }
                            .technicalType(.caption, weight: .bold)
                        }
                        .padding(14)
                        .cardStyle()
                    }
                }
            }
            .padding(18)
        }
        .background(Theme.background)
        .navigationTitle("LAR")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    router.sheet = .capture(.lar)
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Capture for LAR")
            }
        }
        .refreshable { await store.refresh() }
    }

    private func requestTinyStep(_ route: RoutedRequestRecord) {
        loadingTinyStep = route.id
        Task {
            tinySteps[route.id] = await store.tinyStep(for: route)
            loadingTinyStep = nil
        }
    }
}

private struct LARSectionLabel: View {
    let title: String
    let color: Color
    var body: some View {
        Text(title).technicalType(.caption, weight: .bold).foregroundStyle(color)
    }
}

private struct ExecutableRouteCard: View {
    let route: RoutedRequestRecord
    let tinyStep: String?
    let isLoading: Bool
    let requestTinyStep: () -> Void
    let challenge: () -> Void
    let done: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(route.intent)
                .font(.system(.title2, design: .rounded, weight: .bold))
            Text(route.rationale).font(.subheadline).foregroundStyle(Theme.textSecondary)
            if let tinyStep {
                VStack(alignment: .leading, spacing: 5) {
                    Text("TINY STEP").technicalType(.caption2, weight: .bold).foregroundStyle(Theme.success)
                    Text(tinyStep).font(.headline)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.success.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            }
            HStack {
                Button(action: requestTinyStep) {
                    if isLoading { ProgressView() } else { Label("TINY STEP", systemImage: "shoeprints.fill") }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading)
                Button("REK", action: challenge).buttonStyle(.bordered)
                Button("Done", action: done).buttonStyle(.bordered)
            }
            .technicalType(.caption, weight: .bold)
        }
        .padding(20)
        .pocketGlass(tint: Theme.accent.opacity(0.07))
    }
}

private struct CompactRouteRow: View {
    let route: RoutedRequestRecord
    let challenge: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(route.intent).font(.headline)
            HStack {
                Text(route.status.uppercased()).technicalType(.caption2, weight: .bold)
                Spacer()
                Button("REK", action: challenge).buttonStyle(.bordered)
            }
        }
        .padding(14)
        .cardStyle()
    }
}

private struct HonestEmptyState: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(Theme.textSecondary)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardStyle()
    }
}

private struct EmptyActionCard: View {
    let text: String
    let primary: String
    let secondary: String
    let primaryAction: () -> Void
    let secondaryAction: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
            HStack {
                Button(primary, action: primaryAction)
                    .buttonStyle(.borderedProminent)
                Button(secondary, action: secondaryAction)
                    .buttonStyle(.bordered)
            }
            .technicalType(.caption, weight: .bold)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }
}

struct LocalModeBanner: View {
    let title: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: "iphone")
                .technicalType(.caption, weight: .bold)
                .foregroundStyle(Theme.accent)
            Text(detail)
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
