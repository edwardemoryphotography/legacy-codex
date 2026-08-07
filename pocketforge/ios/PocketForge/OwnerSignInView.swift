import SwiftUI

struct OwnerSignInView: View {
    let store: PocketForgeStore
    @State private var appear = false

    var body: some View {
        ZStack {
            ForgeStageBackground()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 18) {
                    Text("PocketForge")
                        .font(Theme.displayFont(44, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                        .opacity(appear ? 1 : 0)
                        .offset(y: appear ? 0 : 14)

                    Text(
                        store.isOwnerEnrolled
                            ? "Your forge is locked."
                            : "Build apps from your phone."
                    )
                    .font(Theme.uiFont(.title3, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .opacity(appear ? 1 : 0)

                    Text(
                        store.isOwnerEnrolled
                            ? "Face ID unlocks this private workspace."
                            : "Enable Face ID once — then forge anytime."
                    )
                    .font(Theme.uiFont(.subheadline))
                    .foregroundStyle(Theme.textSecondary.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)
                    .opacity(appear ? 1 : 0)
                }

                Spacer()

                VStack(spacing: 14) {
                    Button {
                        Task { await store.unlockWithFaceID() }
                    } label: {
                        HStack(spacing: 10) {
                            if store.isUnlocking {
                                ProgressView().tint(Theme.background)
                            }
                            Image(systemName: "faceid")
                                .font(.system(size: 20, weight: .semibold))
                            Text(store.isOwnerEnrolled ? "Unlock with Face ID" : "Enable Face ID")
                                .font(Theme.uiFont(.headline, weight: .bold))
                        }
                        .foregroundStyle(Theme.background)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(Theme.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .shadow(color: Theme.accent.opacity(0.4), radius: 22, y: 10)
                    }
                    .disabled(store.isUnlocking)
                    .accessibilityLabel(store.isOwnerEnrolled ? "Unlock with Face ID" : "Enable Face ID unlock")

                    if case .failed(let message) = store.phase {
                        Text(message)
                            .font(Theme.uiFont(.footnote))
                            .foregroundStyle(Theme.danger)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 36)
                .opacity(appear ? 1 : 0)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.75)) { appear = true }
        }
    }
}
