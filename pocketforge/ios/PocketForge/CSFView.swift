import SwiftUI

struct CSFView: View {
    let store: PocketForgeStore
    let router: AppRouter

    @State private var query = ""

    private var promoted: [CaptureRecord] { store.promotedCaptures }

    var body: some View {
        List {
            if !store.hasRemoteSession {
                Section {
                    LocalModeBanner(
                        title: "CSF on this iPhone",
                        detail: "Promoted context, decisions, and evidence live here until remote Codex is linked."
                    )
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
                }
            }

            Section("CANONICAL / LOCAL CONTEXT") {
                if store.contextResults.isEmpty {
                    ContentUnavailableView(
                        query.isEmpty ? "No context yet" : "No matching records",
                        systemImage: "brain.head.profile",
                        description: Text(
                            query.isEmpty
                                ? "Promote Inbox items to Context, Decision, or Evidence — or capture with CSF intention."
                                : "Nothing matched “\(query)”."
                        )
                    )
                    Button("Capture for CSF") {
                        router.sheet = .capture(.csf)
                    }
                    .buttonStyle(.borderedProminent)
                    Button("Open Inbox") {
                        router.selectedTab = .inbox
                    }
                    .buttonStyle(.bordered)
                } else {
                    ForEach(store.contextResults) { record in
                        ContextRow(record: record) {
                            router.sheet = .rek(text: record.excerpt, captureID: UUID(uuidString: record.id))
                        }
                    }
                }
            }

            if !promoted.isEmpty {
                Section("PROMOTED CAPTURES") {
                    ForEach(promoted) { capture in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(capture.route?.label.uppercased() ?? "CONTEXT")
                                .technicalType(.caption2, weight: .bold)
                                .foregroundStyle(Theme.purple)
                            Text(capture.text)
                            HStack {
                                Button("REK") { router.sheet = .rek(text: capture.text, captureID: capture.id) }
                                    .buttonStyle(.bordered)
                                Button("Dismiss", role: .destructive) {
                                    Task { await store.dismiss(capture) }
                                }
                                .buttonStyle(.bordered)
                            }
                            .technicalType(.caption, weight: .bold)
                        }
                        .padding(.vertical, 4)
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
        .searchable(text: $query, prompt: "Search local or canonical context")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    router.sheet = .capture(.csf)
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Capture for CSF")
            }
        }
        .task {
            await store.searchContext("")
        }
        .task(id: query) {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            await store.searchContext(query)
        }
        .refreshable {
            await store.refresh()
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
                Text(record.provenance == "local" ? "LOCAL" : "CANONICAL")
                    .technicalType(.caption2, weight: .bold)
                    .foregroundStyle(record.provenance == "local" ? Theme.accent : Theme.success)
            }
            Text(record.title).font(.headline)
            Text(record.excerpt).font(.subheadline).foregroundStyle(Theme.textSecondary).lineLimit(5)
            Button("REK", action: challenge).buttonStyle(.bordered)
        }
        .padding(.vertical, 5)
    }
}
