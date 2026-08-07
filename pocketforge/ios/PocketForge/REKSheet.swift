import SwiftUI

struct REKSheet: View {
    let store: PocketForgeStore
    let input: String

    @Environment(\.dismiss) private var dismiss
    @State private var assessment: RekAssessment?
    @State private var isLoading = true

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
                        ProgressView("Checking canonical contextâ¦")
                    } else if let assessment {
                        AssessmentView(assessment: assessment)
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
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .task {
                assessment = await store.challenge(input)
                isLoading = false
            }
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
                        Text(source.title).font(.subheadline.weight(.semibold))
                        Text(source.excerpt).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(4)
                    }
                    .padding(12)
                    .cardStyle()
                }
            }
            if let model = assessment.model {
                Text("Model judgment Â· \(model)")
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
