import SwiftUI

struct CaptureSheet: View {
    let store: PocketForgeStore
    let router: AppRouter
    let initialIntention: CaptureIntention

    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var intention: CaptureIntention
    @State private var isSaving = false
    @FocusState private var focused: Bool

    init(store: PocketForgeStore, router: AppRouter, initialIntention: CaptureIntention) {
        self.store = store
        self.router = router
        self.initialIntention = initialIntention
        _intention = State(initialValue: initialIntention)
        _text = State(initialValue: IntentHandoff.prefilledCapture ?? "")
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Picker("Routing intention", selection: $intention) {
                    ForEach(CaptureIntention.allCases) { item in
                        Label(item.label, systemImage: item.symbol).tag(item)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityHint("This records an intention only. The thought stays in Inbox until deliberately promoted.")

                ZStack(alignment: .topLeading) {
                    TextEditor(text: $text)
                        .focused($focused)
                        .font(.body)
                        .scrollContentBackground(.hidden)
                        .padding(10)
                    if text.isEmpty {
                        Text("Get it out of your head. Route it later.")
                            .foregroundStyle(Theme.textSecondary)
                            .padding(.horizontal, 15)
                            .padding(.vertical, 18)
                            .allowsHitTesting(false)
                    }
                }
                .frame(minHeight: 160)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border))

                Text("Capture does not become durable context until you promote it.")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Spacer()
            }
            .padding(18)
            .background(Theme.background)
            .navigationTitle("CAPTURE")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) {
                        if isSaving { ProgressView() } else { Text("SAVE") }
                    }
                    .technicalType(.body, weight: .bold)
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
            .onAppear {
                IntentHandoff.prefilledCapture = nil
                focused = true
            }
        }
    }

    private func save() {
        isSaving = true
        let capturedText = text
        Task {
            let outcome = await store.capture(text: capturedText, intention: intention)
            isSaving = false
            guard outcome != nil else { return }
            if intention == .rek, outcome == .synced {
                router.sheet = .rek(capturedText)
            } else {
                dismiss()
            }
        }
    }
}
