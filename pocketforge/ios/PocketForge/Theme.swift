import SwiftUI

enum Theme {
    static let accent = Color(red: 0.18, green: 0.86, blue: 0.95)
    static let accentSoft = accent.opacity(0.14)
    static let purple = Color(red: 0.63, green: 0.45, blue: 0.96)
    static let foundry = Color(red: 0.96, green: 0.47, blue: 0.18)
    static let warning = Color(red: 0.96, green: 0.66, blue: 0.20)
    static let background = Color(red: 0.018, green: 0.024, blue: 0.034)
    static let surface = Color(red: 0.07, green: 0.085, blue: 0.11)
    static let surfaceRaised = Color(red: 0.105, green: 0.12, blue: 0.15)
    static let border = Color.white.opacity(0.1)
    static let textPrimary = Color.white
    static let textSecondary = Color.white.opacity(0.6)
    static let success = Color(red: 0.25, green: 0.78, blue: 0.45)
    static let danger = Color(red: 0.92, green: 0.32, blue: 0.32)

    static let heroGradient = LinearGradient(
        colors: [accent, purple],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
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
        self.font(.system(style, design: .rounded, weight: weight))
    }
}

extension Text {
    func technicalType(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Text {
        self.font(.system(style, design: .rounded, weight: weight))
    }
}
