import SwiftUI

/// Kept for previews / alternate entry — mirrors the Replit-style forge hero.
struct WelcomeView: View {
    @AppStorage("hasEnteredApp") private var hasEnteredApp = false
    @State private var appear = false

    var body: some View {
        ZStack {
            ForgeStageBackground()

            VStack(spacing: 22) {
                Spacer()
                Text("PocketForge")
                    .font(Theme.displayFont(42, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                Text("What will you forge?")
                    .font(Theme.displayFont(28, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                Text("Turn ideas into live apps in minutes.")
                    .font(Theme.uiFont(.body, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 10)

                VStack(alignment: .leading, spacing: 18) {
                    featureRow(symbol: "wand.and.stars", title: "AI builder",
                               detail: "Claude designs and codes complete web apps from a sentence.")
                    featureRow(symbol: "cloud.fill", title: "Instant hosting",
                               detail: "Every app goes live on the web with its own URL.")
                    featureRow(symbol: "bubble.left.and.bubble.right.fill", title: "Iterate by chat",
                               detail: "Ask for changes and watch them go live in seconds.")
                }
                .padding(26)
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardStyle()
                .padding(.horizontal, 24)
                .padding(.top, 44)

                Spacer()
                Button {
                    hasEnteredApp = true
                } label: {
                    Text("Start forging")
                        .font(Theme.uiFont(.headline, weight: .bold))
                        .foregroundStyle(Theme.background)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(Theme.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 36)
            }
            .opacity(appear ? 1 : 0)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.7)) { appear = true }
        }
    }
}

#Preview {
    WelcomeView().preferredColorScheme(.dark)
}
