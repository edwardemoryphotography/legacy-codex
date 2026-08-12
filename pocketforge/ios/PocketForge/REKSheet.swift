import SwiftUI

struct REKSheet: View {
    let store: PocketForgeStore
    let input: String
    var captureID: UUID? = nil
    var onOpenCSF: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var assessment: RekAssessment?
    @State private var isLoading = true
    @State private var isSaving = false

    private var needsEvidenceAction: Bool {
        guard let assessment else { return false }
        return assessment.status == .missingEvidence
            || assessment.sources.contains(where: { $0.provenance == "local-self" })
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("CHALLENGE")
                        .technicalType(.caption, weight: .bold)
                        .foregroundStyle(Theme.purple)
                    Text(input).font(.headline)
                    Divider().overlay(Theme.border)
                    if isLoading {
                        ProgressView("Checking context…")
                    } else if let assessment {
                        AssessmentView(assessment: assessment)
                        if needsEvidenceAction {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("NEXT MOVE")
                                    .technicalType(.caption2, weight: .bold)
                                    .foregroundStyle(Theme.accent)
                                Text("Save this claim into CSF, or promote a related Inbox item to CSF, then run REK again.")
                                    .font(.footnote)
                                    .foregroundStyle(Theme.textSecondary)
                                Button {
                                    saveAsEvidence()
                                } label: {
                                    if isSaving {
                                        ProgressView()
                                    } else {
                                        Label("Save as CSF evidence", systemImage: "tray.and.arrow.down.fill")
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(isSaving)

                                Button("Open CSF") {
                                    dismiss()
                                    onOpenCSF?()
                                }
                                .buttonStyle(.bordered)
                            }
                            .padding(.top, 4)
                        }
                    } else {
                        Label("UNABLE TO VERIFY", systemImage: "questionmark.shield")
                            .technicalType(.headline, weight: .bold)
                            .foregroundStyle(Theme.warning)
                        Text("No challenge result was returned. No conflict status has been inferred.")
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("REK")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                assessment = await store.challenge(input, captureID: captureID)
                isLoading = false
            }
        }
    }

    private func saveAsEvidence() {
        isSaving = true
        Task {
            let ok = await store.saveAsCSFEvidence(text: input, captureID: captureID)
            isSaving = false
            guard ok else { return }
            assessment = await store.challenge(input, captureID: captureID)
        }
    }
}

private struct AssessmentView: View {
    let assessment: RekAssessment

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(assessment.status.label, systemImage: symbol)
                .technicalType(.headline, weight: .bold)
                .foregroundStyle(color)
            Text(assessment.summary).font(.body)
            if !assessment.sources.isEmpty {
                Text("SOURCES").technicalType(.caption, weight: .bold).foregroundStyle(Theme.textSecondary)
                ForEach(assessment.sources) { source in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(source.title).font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(source.section.uppercased())
                                .technicalType(.caption2, weight: .bold)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        Text(source.excerpt).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(4)
                        if source.provenance == "local-self" {
                            Text("Provisional — not CSF yet")
                                .technicalType(.caption2, weight: .bold)
                                .foregroundStyle(Theme.warning)
                        }
                    }
                    .padding(12)
                    .cardStyle()
                }
            }
            if let model = assessment.model {
                Text("Model judgment · \(model)")
                    .technicalType(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
    }

    private var color: Color {
        switch assessment.status {
        case .verifiedConflict, .possibleConflict: Theme.danger
        case .missingEvidence, .unableToVerify: Theme.warning
        case .noConflictFound: Theme.success
        }
    }

    private var symbol: String {
        switch assessment.status {
        case .verifiedConflict: "xmark.shield.fill"
        case .possibleConflict: "exclamationmark.shield.fill"
        case .missingEvidence: "doc.badge.ellipsis"
        case .noConflictFound: "checkmark.shield.fill"
        case .unableToVerify: "questionmark.shield"
        }
    }
}
