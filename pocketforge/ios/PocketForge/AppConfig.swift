import Foundation

enum AppConfig {
    /// Convex deployment URL (printed by `npx convex dev` / `npx convex deploy`).
    /// Convex deployment for the Legacy Builder (Claude + Daytona).
    static let convexDeploymentURL = "https://scintillating-loris-226.convex.cloud"

    /// Public Supabase project URL (anon key is optional for local-only mode).
    static let supabaseURL: URL? = URL(string: stringValue(for: "PocketForgeSupabaseURL")
        ?? "https://pkydkbuodikttfeawqsw.supabase.co")

    /// Publishable/anon key from Info.plist build setting. Empty ⇒ local-only.
    static var supabaseAnonKey: String? {
        let value = stringValue(for: "PocketForgeSupabaseAnonKey")?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let value, !value.isEmpty, !value.hasPrefix("$(") else { return nil }
        return value
    }

    static var isSupabaseConfigured: Bool {
        supabaseURL != nil && supabaseAnonKey != nil
    }

    /// Legacy Codex web API host for CSF / REK / Tiny Step.
    static let codexBaseURL: URL = URL(string: stringValue(for: "PocketForgeCodexBaseURL")
        ?? "https://legacy-codex.vercel.app")!

    private static func stringValue(for key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }
}
