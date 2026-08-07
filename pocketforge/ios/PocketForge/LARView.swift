import SwiftUI

struct LARView: View {
    let store: PocketForgeStore
    let router: AppRouter

    @State private var tinySteps: [UUID: String] = [:]
    @State private var loadingTinyStep: UUID?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                LARSectionLabel(title: "NOW", color: Theme.accent)
                if let route = store.lar.now {
                    ExecutableRouteCard(
                        route: route,
                        tinyStep: tinySteps[route.id],
                        isLoading: loadingTinyStep == route.id,
                        requestTinyStep: { requestTinyStep(route) },
                        challenge: { router.sheet = .rek(route.intent) }
                    )
                } else {
                    HonestEmptyState(text: "No executable action is recorded.")
                }

                LARSectionLabel(title: "NEXT", color: Theme.purple)
                if store.lar.next.isEmpty {
                    HonestEmptyState(text: "No queued executable routes.")
                } else {
                    ForEach(store.lar.next) { route in
                        CompactRouteRow(route: route) { router.sheet = .rek(route.intent) }
                    }
                }

                LARSectionLabel(title: "BLOCKED / WAITING", color: Theme.danger)
                if store.lar.blocked.isEmpty {
                    HonestEmptyState(text: "No blocked routes.")
                } else {
                    ForEach(store.lar.blocked) { route in
                        CompactRouteRow(route: route) { router.sheet = .rek(route.intent) }
                    }
                }
            }
            .padding(18)
        }
        .background(Theme.background)
        .navigationTitle("LAR")
        .navigationBarTitleDisplayMode(.inline)
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
