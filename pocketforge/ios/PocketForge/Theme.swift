import SwiftUI

/// PocketForge visual identity: deep slate surfaces with a forge-orange
/// accent — warm, energetic, unmistakably "builder".
enum Theme {
    static let accent = Color(red: 0.95, green: 0.42, blue: 0.13)        // forge orange
    static let accentSoft = Color(red: 0.95, green: 0.42, blue: 0.13).opacity(0.16)
    static let background = Color(red: 0.055, green: 0.06, blue: 0.08)
    static let surface = Color(red: 0.10, green: 0.11, blue: 0.14)
    static let surfaceRaised = Color(red: 0.14, green: 0.15, blue: 0.19)
    static let border = Color.white.opacity(0.08)
    static let textPrimary = Color.white
    static let textSecondary = Color.white.opacity(0.6)
    static let success = Color(red: 0.25, green: 0.78, blue: 0.45)
    static let danger = Color(red: 0.92, green: 0.32, blue: 0.32)

    static let heroGradient = LinearGradient(
        colors: [
            Color(red: 0.95, green: 0.42, blue: 0.13),
            Color(red: 0.85, green: 0.20, blue: 0.45),
        ],
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
}
