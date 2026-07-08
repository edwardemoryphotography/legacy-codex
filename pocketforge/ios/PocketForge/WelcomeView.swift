import SwiftUI

struct WelcomeView: View {
    @AppStorage("hasEnteredApp") private var hasEnteredApp = false
    @State private var glow = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            // Ambient glow behind the logo.
            Circle()
                .fill(Theme.heroGradient)
                .frame(width: 320, height: 320)
                .blur(radius: 110)
                .opacity(glow ? 0.55 : 0.3)
                .offset(y: -180)
                .animation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true), value: glow)

            VStack(spacing: 0) {
                Spacer()

                ZStack {
                    RoundedRectangle(cornerRadius: 32, style: .continuous)
                        .fill(Theme.heroGradient)
                        .frame(width: 120, height: 120)
                        .shadow(color: Theme.accent.opacity(0.5), radius: 30, y: 10)
                    Image(systemName: "hammer.fill")
                        .font(.system(size: 52, weight: .bold))
                        .foregroundStyle(.white)
                }
                .padding(.bottom, 28)

                Text("PocketForge")
                    .font(.system(size: 40, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.textPrimary)

                Text("Describe it. Watch it get built.\nRun it — all from your phone.")
                    .font(.system(.title3, design: .rounded))
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 10)

                VStack(alignment: .leading, spacing: 18) {
                    featureRow(symbol: "wand.and.stars", title: "AI builder",
                               detail: "Claude designs and codes complete web apps from a sentence.")
                    featureRow(symbol: "cloud.fill", title: "Cloud sandboxes",
                               detail: "Every app runs live in its own Daytona sandbox.")
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
                    Text("Enter App")
                        .font(.system(.title3, design: .rounded).weight(.bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(Theme.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .shadow(color: Theme.accent.opacity(0.45), radius: 18, y: 8)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 18)
            }
        }
        .onAppear { glow = true }
    }

    private func featureRow(symbol: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .frame(width: 34, height: 34)
                .background(Theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                Text(detail)
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

#Preview {
    WelcomeView().preferredColorScheme(.dark)
}
