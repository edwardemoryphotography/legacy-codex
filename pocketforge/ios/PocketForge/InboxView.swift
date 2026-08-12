import SwiftUI

struct InboxView: View {
    let store: PocketForgeStore
    let router: AppRouter

    private var inbox: [CaptureRecord] { store.openInboxCaptures }

    var body: some View {
        List {
            Section {
                if !store.hasRemoteSession {
                    Label("Working on this iPhone — promote, forge, or dismiss below.", systemImage: "iphone")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                        .listRowBackground(Theme.surface.opacity(0.5))
                }
            }

            Section("OPEN") {
                if inbox.isEmpty {
                    ContentUnavailableView(
                        "Inbox clear",
                        systemImage: "tray",
                        description: Text("Capture a thought, then promote it to LAR, CSF, Forge, or dismiss it.")
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
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    router.sheet = .capture(.inbox)
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Capture")
            }
        }
        .refreshable { await store.refresh() }
    }
}

private struct CaptureRow: View {
    let capture: CaptureRecord
    let store: PocketForgeStore
    let router: AppRouter
    @State private var isWorking = false

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
                if isWorking {
                    ProgressView().controlSize(.small)
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    actionButton("LAR", systemImage: "bolt.fill") {
                        let ok = await store.promote(capture, to: .action)
                        if ok { router.selectedTab = .lar }
                    }
                    actionButton("CSF", systemImage: "brain.head.profile") {
                        let ok = await store.promote(capture, to: .context)
                        if ok { router.selectedTab = .csf }
                    }
                    actionButton("Forge", systemImage: "flame.fill") {
                        if await store.forge(from: capture) != nil {
                            router.selectedTab = .status
                        }
                    }
                    actionButton("REK", systemImage: "shield.lefthalf.filled") {
                        router.sheet = .rek(text: capture.text, captureID: capture.id)
                    }
                    Menu {
                        ForEach(CaptureRoute.allCases.filter { ![.foundryRequest, .action, .context, .archive].contains($0) }) { route in
                            Button(route.label) {
                                Task { _ = await store.promote(capture, to: route) }
                            }
                        }
                        if store.hasRemoteSession {
                            Button("Send to Foundry") { router.sheet = .foundry(capture) }
                        }
                        Divider()
                        Button("Dismiss", role: .destructive) {
                            Task { await store.dismiss(capture) }
                        }
                        Button("Delete", role: .destructive) {
                            Task { await store.deleteLocal(capture) }
                        }
                    } label: {
                        Label("More", systemImage: "ellipsis.circle")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(Theme.surface)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(.vertical, 6)
    }

    private func actionButton(_ title: String, systemImage: String, action: @escaping () async -> Void) -> some View {
        Button {
            isWorking = true
            Task {
                await action()
                isWorking = false
            }
        } label: {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Theme.accentSoft)
                .foregroundStyle(Theme.accent)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(isWorking)
    }
}
