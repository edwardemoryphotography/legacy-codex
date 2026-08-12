import Foundation

actor PendingCaptureStore {
    static let shared = PendingCaptureStore()

    private let fileURL: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(fileManager: FileManager = .default) {
        let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = support.appendingPathComponent("PocketForge", isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("pending-captures.json")
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    func all() -> [PendingCapture] {
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        return (try? decoder.decode([PendingCapture].self, from: data)) ?? []
    }

    func enqueue(_ capture: PendingCapture) throws {
        var captures = all()
        if let index = captures.firstIndex(where: { $0.id == capture.id }) {
            captures[index] = capture
        } else {
            captures.append(capture)
        }
        try persist(captures)
    }

    func remove(id: UUID) throws {
        try persist(all().filter { $0.id != id })
    }

    private func persist(_ captures: [PendingCapture]) throws {
        let data = try encoder.encode(captures)
        try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
    }
}
