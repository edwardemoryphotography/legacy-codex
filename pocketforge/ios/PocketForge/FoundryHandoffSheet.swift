import SwiftUI

struct FoundryHandoffSheet: View {
    let store: PocketForgeStore
    let capture: CaptureRecord

    @Environment(\.dismiss) private var dismiss
    @State private var handoff: FoundryHandoff
    @State private var isSending = false

    init(store: PocketForgeStore, capture: CaptureRecord) {
        self.store = store
        self.capture = capture
        _handoff = State(initialValue: FoundryHandoff(capture: capture))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("OWNER INTENT") { Text(capture.text) }
                Section("REAL ROUTING CONTRACT") {
                    Picker("Workspace", selection: $handoff.workspaceID) {
                        Text("Choose workspace").tag(UUID?.none)
                        ForEach(store.workspaces) { workspace in
                            Text(workspace.name).tag(Optional(workspace.id))
                        }
                    }
                    TextField("Repository", text: $handoff.repository)
                        .textInputAutocapitalization(.never)
                    TextField("Repository path (optional)", text: $handoff.repositoryPath)
                        .textInputAutocapitalization(.never)
                    TextField("Task type", text: $handoff.taskType)
                    TextField("Required evidence", text: $handoff.requiredEvidence, axis: .vertical)
                        .lineLimit(2...5)
                    Picker("Risk", selection: $handoff.risk) {
                        ForEach(["low", "medium", "high", "critical"], id: \.self) { Text($0.capitalized).tag($0) }
                    }
                    Picker("Sensitivity", selection: $handoff.sensitivity) {
                        ForEach(["public", "internal", "private", "restricted"], id: \.self) { Text($0.capitalized).tag($0) }
                    }
                }
                Section {
                    Text("This creates a real routed request and pending evidence through the atomic Foundry boundary. It does not claim execution started.")
                        .font(.footnote)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("SEND TO FOUNDRY")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: send) {
                        if isSending { ProgressView() } else { Text("SEND") }
                    }
                    .disabled(!isValid || isSending)
                }
            }
        }
    }

    private var isValid: Bool {
        handoff.workspaceID != nil
            && !handoff.repository.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !handoff.taskType.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !handoff.requiredEvidence.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func send() {
        isSending = true
        Task {
            let success = await store.sendToFoundry(handoff)
            isSending = false
            if success { dismiss() }
        }
    }
}
