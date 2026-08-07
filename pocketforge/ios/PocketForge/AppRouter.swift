import Foundation
import Observation
import SwiftUI

enum AppSheet: Identifiable, Hashable {
    case capture(CaptureIntention)
    case rek(String)
    case foundry(CaptureRecord)

    var id: String {
        switch self {
        case .capture: "capture"
        case .rek(let text): "rek:\(text.hashValue)"
        case .foundry(let capture): "foundry:\(capture.id)"
        }
    }
}

@MainActor
@Observable
final class AppRouter {
    var selectedTab: AppTab = .status
    var sheet: AppSheet?

    func handle(_ url: URL) {
        guard url.scheme == "pocketforge" else { return }
        let destination = url.host ?? url.pathComponents.dropFirst().first ?? ""
        switch destination.lowercased() {
        case "status": selectedTab = .status
        case "inbox": selectedTab = .inbox
        case "lar": selectedTab = .lar
        case "csf": selectedTab = .csf
        case "capture":
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            let text = components?.queryItems?.first(where: { $0.name == "text" })?.value
            IntentHandoff.prefilledCapture = text
            sheet = .capture(.inbox)
        default: break
        }
    }

    func consumeIntentHandoff() {
        guard let url = IntentHandoff.consumeURL() else { return }
        handle(url)
    }
}

enum IntentHandoff {
    private static let urlKey = "PocketForge.IntentHandoff.URL"
    private static let captureKey = "PocketForge.IntentHandoff.Capture"

    static var prefilledCapture: String? {
        get { UserDefaults.standard.string(forKey: captureKey) }
        set { UserDefaults.standard.set(newValue, forKey: captureKey) }
    }

    static func stage(_ url: URL) {
        UserDefaults.standard.set(url.absoluteString, forKey: urlKey)
    }

    static func consumeURL() -> URL? {
        guard let value = UserDefaults.standard.string(forKey: urlKey) else { return nil }
        UserDefaults.standard.removeObject(forKey: urlKey)
        return URL(string: value)
    }
}
