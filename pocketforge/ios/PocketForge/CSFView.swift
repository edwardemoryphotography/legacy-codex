import SwiftUI

struct CSFView: View {
    let store: PocketForgeStore
    let router: AppRouter

    @State private var query = ""

    private var promoted: [CaptureRecord] {
        store.captures.filter { $0.state == .promoted }
    }

    var body: some View {
        List {
            Section("CANONICAL CODEX") {
                if !store.hasRemoteSession {
                    ContentUnavailableView(
                        "Local mode",
                        systemImage: "iphone",
                        description: Text("Canonical search runs when a remote Codex session is linked. Face ID unlock is enough for capture and Legacy Builder.")
                    )
                } else if store.contextResults.isEmpty {
                    ContentUnavailableView(
                        query.isEmpty ? "No context records" : "No matching records",
                        systemImage: "brain.head.profile",
                        description: Text(store.contextSearchAvailable ? "No canonical record matched this search." : "Search didn’t return results.")
                    )
                } else {
                    ForEach(store.contextResults) { record in
                        ContextRow(record: record) { router.sheet = .rek(record.excerpt) }
                    }
                }
            }

            if !promoted.isEmpty {
                Section("PROMOTED CAPTURES") {
                    ForEach(promoted) { capture in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(capture.route?.label.uppercased() ?? "CONTEXT")
                                .technicalType(.caption2, weight: .bold)
                                .foregroundStyle(Theme.purple)
                            Text(capture.text)
                            Button("CHALLENGE WITH REK") { router.sheet = .rek(capture.text) }
                                .technicalType(.caption, weight: .bold)
                                .buttonStyle(.bordered)
                        }
                    }
                }
            }

            if !store.evidence.isEmpty {
                Section("EVIDENCE") {
                    ForEach(store.evidence.prefix(20)) { item in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(item.status.uppercased())
                                .technicalType(.caption2, weight: .bold)
                                .foregroundStyle(evidenceColor(item.status))
                            Text(item.claim)
                            if let source = item.source {
                                Text(source).font(.caption).foregroundStyle(Theme.textSecondary)
                            }
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("CSF")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Search canonical context")
        .disabled(!store.hasRemoteSession)
        .task {
            guard store.hasRemoteSession else { return }
            await store.searchContext("")
        }
        .task(id: query) {
            guard store.hasRemoteSession else { return }
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            await store.searchContext(query)
        }
        .refreshable {
            guard store.hasRemoteSession else { return }
            await store.searchContext(query)
        }
    }

    private func evidenceColor(_ status: String) -> Color {
        switch status {
        case "verified": Theme.success
        case "conflict": Theme.danger
        case "pending", "stale", "unverified": Theme.warning
        default: Theme.textSecondary
        }
    }
}

private struct ContextRow: View {
    let record: CodexContextRecord
    let challenge: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(record.section.uppercased())
                    .technicalType(.caption2, weight: .bold)
                    .foregroundStyle(Theme.accent)
                Spacer()
                Text("CANONICAL").technicalType(.caption2, weight: .bold).foregroundStyle(Theme.success)
            }
            Text(record.title).font(.headline)
            Text(record.excerpt).font(.subheadline).foregroundStyle(Theme.textSecondary).lineLimit(5)
            Button("REK", action: challenge).buttonStyle(.bordered)
        }
        .padding(.vertical, 5)
    }
}
