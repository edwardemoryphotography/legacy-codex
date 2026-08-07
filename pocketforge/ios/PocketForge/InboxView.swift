import SwiftUI

struct InboxView: View {
    let store: PocketForgeStore
    let router: AppRouter

    private var inbox: [CaptureRecord] { store.captures.filter { $0.state == .inbox } }

    var body: some View {
        List {
            if !store.pendingCaptures.isEmpty {
                Section("WAITING ON THIS IPHONE") {
                    ForEach(store.pendingCaptures) { capture in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(capture.text)
                            Label("Not yet in Codex", systemImage: "iphone.and.arrow.forward")
                                .font(.caption)
                                .foregroundStyle(Theme.warning)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }

            Section("UNPROCESSED COGNITION") {
                if inbox.isEmpty {
                    ContentUnavailableView(
                        "No inbox records",
                        systemImage: "tray",
                        description: Text("Capture a thought without classifying it first.")
                    )
                } else {
                    ForEach(inbox) { capture in
                        CaptureRow(capture: capture, store: store, router: router)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("INBOX")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Text("\(store.unresolvedInboxCount) OPEN")
                    .technicalType(.caption2, weight: .bold)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .refreshable { await store.refresh() }
    }
}

private struct CaptureRow: View {
    let capture: CaptureRecord
    let store: PocketForgeStore
    let router: AppRouter

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(capture.text)
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Text(capture.createdAt)
                    .technicalType(.caption2)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                Spacer()
                Menu {
                    ForEach(CaptureRoute.allCases.filter { $0 != .foundryRequest }) { route in
                        Button(route.label) { Task { _ = await store.promote(capture, to: route) } }
                    }
                    Divider()
                    Button("Challenge with REK") { router.sheet = .rek(capture.text) }
                    Button("Send to Foundry") { router.sheet = .foundry(capture) }
                } label: {
                    Label("Route", systemImage: "arrow.triangle.branch")
                        .frame(minHeight: 44)
                }
                .accessibilityHint("Classify, challenge, archive, or send this capture to Foundry")
            }
        }
        .padding(.vertical, 6)
    }
}
