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
    let updatedAt: Double

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case creationTime = "_creationTime"
        case name, prompt, status, statusDetail, sandboxId, previewUrl, icon, updatedAt
    }

    var isBuilding: Bool { status == "building" }
    var isLive: Bool { status == "live" }
    var isError: Bool { status == "error" }

    var symbolName: String { icon ?? "sparkles" }
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
