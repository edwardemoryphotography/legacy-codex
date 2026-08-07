import SwiftUI

struct OwnerSignInView: View {
    let store: PocketForgeStore

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            Spacer()
            Image(systemName: "faceid")
                .font(.system(size: 46, weight: .light))
                .foregroundStyle(Theme.accent)

            VStack(alignment: .leading, spacing: 8) {
                Text("POCKETFORGE")
                    .technicalType(.largeTitle, weight: .bold)
                Text(store.isOwnerEnrolled ? "Your Codex is locked." : "Owner access on this iPhone.")
                    .font(.title3)
                    .foregroundStyle(Theme.textSecondary)
            }

            VStack(alignment: .leading, spacing: 14) {
                Text(
                    store.isOwnerEnrolled
                        ? "Face ID unlocks PocketForge on this iPhone. No email link."
                        : "Enable Face ID once on this iPhone. PocketForge no longer uses email magic links."
                )
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)

                Button {
                    Task { await store.unlockWithFaceID() }
                } label: {
                    HStack {
                        if store.isUnlocking { ProgressView().tint(Theme.background) }
                        Label(
                            store.isOwnerEnrolled ? "UNLOCK WITH FACE ID" : "ENABLE FACE ID UNLOCK",
                            systemImage: "faceid"
                        )
                        .technicalType(.body, weight: .bold)
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
                .foregroundStyle(Theme.background)
                .disabled(store.isUnlocking)
                .accessibilityLabel(store.isOwnerEnrolled ? "Unlock with Face ID" : "Enable Face ID unlock")
            }

            if case .failed(let message) = store.phase {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(Theme.danger)
                    .accessibilityLabel("Authentication failed. \(message)")
            }

            Spacer()
            Text("LOCAL OWNER · KEYCHAIN · FACE ID")
                .technicalType(.caption2, weight: .semibold)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(28)
        .background(Theme.background)
    }
}
