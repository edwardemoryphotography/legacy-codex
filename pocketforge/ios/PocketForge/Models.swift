import Foundation

struct Project: Decodable, Identifiable, Equatable, Hashable {
    let id: String
    let creationTime: Double
    let name: String
    let prompt: String
    let status: String
    let statusDetail: String?
    let sandboxId: String?
    let previewUrl: String?
    let icon: String?
    let provider: String?
    let updatedAt: Double

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case creationTime = "_creationTime"
        case name, prompt, status, statusDetail, sandboxId, previewUrl, icon, provider, updatedAt
    }

    var isBuilding: Bool { status == "building" }
    var isLive: Bool { status == "live" }
    var isError: Bool { status == "error" }

    var symbolName: String { icon ?? "sparkles" }

    var providerLabel: String {
        switch (provider ?? "auto").lowercased() {
        case "anthropic": return "Claude"
        case "openai": return "GPT"
        case "gemini": return "Gemini"
        default: return "Auto"
        }
    }
}

enum ModelProvider: String, CaseIterable, Identifiable {
    case auto
    case anthropic
    case openai
    case gemini

    var id: String { rawValue }

    var label: String {
        switch self {
        case .auto: "Auto"
        case .anthropic: "Claude"
        case .openai: "GPT"
        case .gemini: "Gemini"
        }
    }
}

struct Message: Decodable, Identifiable, Equatable {
    let id: String
    let creationTime: Double
    let projectId: String
    let role: String
    let content: String

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case creationTime = "_creationTime"
        case projectId, role, content
    }

    var isUser: Bool { role == "user" }
    var isStatus: Bool { role == "status" }
}

/// A dice-rolled app suggestion from the backend idea generator.
struct AppIdea: Decodable, Identifiable, Equatable {
    var id: String { title }
    let title: String
    let prompt: String
    let icon: String
}

struct ProjectFile: Decodable, Identifiable, Equatable {
    let id: String
    let projectId: String
    let path: String
    let content: String
    let updatedAt: Double

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case projectId, path, content, updatedAt
    }

    var fileSymbol: String {
        if path.hasSuffix(".html") { return "globe" }
        if path.hasSuffix(".css") { return "paintbrush.fill" }
        if path.hasSuffix(".js") { return "curlybraces" }
        if path.hasSuffix(".json") { return "doc.text" }
        return "doc"
    }
}
