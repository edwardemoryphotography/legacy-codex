import SwiftUI

/// PocketForge visual system — Replit/Lovable competitor energy:
/// deep ink stage, warm forge-orange brand signal, serif display type.
enum Theme {
    /// Replit-adjacent forge orange (brand hero accent).
    static let accent = Color(red: 0.95, green: 0.38, blue: 0.05)
    static let accentSoft = accent.opacity(0.16)
    static let accentGlow = Color(red: 1.0, green: 0.55, blue: 0.18)

    static let purple = Color(red: 0.55, green: 0.42, blue: 0.95)
    static let foundry = accent
    static let warning = Color(red: 0.98, green: 0.72, blue: 0.28)
    static let success = Color(red: 0.35, green: 0.86, blue: 0.52)
    static let danger = Color(red: 0.96, green: 0.35, blue: 0.32)

    /// Near-black stage with a cool undertone (not flat #000).
    static let background = Color(red: 0.04, green: 0.045, blue: 0.055)
    static let surface = Color(red: 0.09, green: 0.095, blue: 0.11)
    static let surfaceRaised = Color(red: 0.13, green: 0.135, blue: 0.155)
    static let border = Color.white.opacity(0.10)
    static let textPrimary = Color(red: 0.98, green: 0.97, blue: 0.95)
    static let textSecondary = Color.white.opacity(0.58)

    static let heroGradient = LinearGradient(
        colors: [accent, accentGlow, Color(red: 0.95, green: 0.25, blue: 0.35)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let stageGradient = LinearGradient(
        colors: [
            Color(red: 0.08, green: 0.05, blue: 0.04),
            background,
            Color(red: 0.03, green: 0.04, blue: 0.08),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static func displayFont(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }

    static func uiFont(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .rounded, weight: weight)
    }
}

/// Full-bleed atmospheric stage: mesh glow + subtle grain of light.
struct ForgeStageBackground: View {
    var intensity: Double = 1
    @State private var pulse = false

    var body: some View {
        ZStack {
            Theme.stageGradient.ignoresSafeArea()

            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Theme.accent.opacity(0.45 * intensity),
                            Theme.accentGlow.opacity(0.12 * intensity),
                            .clear,
                        ],
                        center: .center,
                        startRadius: 10,
                        endRadius: 220
                    )
                )
                .frame(width: 440, height: 440)
                .offset(x: -40, y: -220)
                .scaleEffect(pulse ? 1.08 : 0.92)
                .blur(radius: 8)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color(red: 0.2, green: 0.15, blue: 0.45).opacity(0.35 * intensity),
                            .clear,
                        ],
                        center: .center,
                        startRadius: 20,
                        endRadius: 180
                    )
                )
                .frame(width: 320, height: 320)
                .offset(x: 140, y: 280)
                .blur(radius: 6)

            // Soft vignette
            LinearGradient(
                colors: [.clear, Theme.background.opacity(0.85)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 4.2).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }
}

extension View {
    func cardStyle() -> some View {
        self
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
    }

    @ViewBuilder
    func pocketGlass(interactive: Bool = false, tint: Color? = nil) -> some View {
        if #available(iOS 26.0, *) {
            if interactive {
                self.glassEffect(.regular.tint(tint ?? .clear).interactive(), in: .rect(cornerRadius: 18))
            } else {
                self.glassEffect(.regular.tint(tint ?? .clear), in: .rect(cornerRadius: 18))
            }
        } else {
            self
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(Theme.border, lineWidth: 1)
                )
        }
    }

    func technicalType(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> some View {
        self.font(Theme.uiFont(style, weight: weight))
    }
}

extension Text {
    func technicalType(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Text {
        self.font(Theme.uiFont(style, weight: weight))
    }
}
