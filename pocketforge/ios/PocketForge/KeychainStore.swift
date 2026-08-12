import Foundation
import Security

enum KeychainStore {
    private static let service = "com.edwardemory.pocketforge.owner-session"
    private static let remoteAccount = "supabase"
    private static let localAccount = "local-owner"

    static func load() -> Data? {
        load(account: remoteAccount)
    }

    static func save(_ data: Data) throws {
        try save(data, account: remoteAccount)
    }

    static func remove() {
        remove(account: remoteAccount)
    }

    static func loadLocalOwnerEnrollment() -> Data? {
        load(account: localAccount)
    }

    static func saveLocalOwnerEnrollment(_ data: Data) throws {
        try save(data, account: localAccount)
    }

    static func removeLocalOwnerEnrollment() {
        remove(account: localAccount)
    }

    private static func load(account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess else { return nil }
        return item as? Data
    }

    private static func save(_ data: Data, account: String) throws {
        let lookup: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let updateStatus = SecItemUpdate(lookup as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var insertion = lookup
            attributes.forEach { insertion[$0.key] = $0.value }
            let addStatus = SecItemAdd(insertion as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw KeychainFailure.status(addStatus) }
        } else if updateStatus != errSecSuccess {
            throw KeychainFailure.status(updateStatus)
        }
    }

    private static func remove(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

enum KeychainFailure: Error {
    case status(OSStatus)
}

enum LocalOwnerAccess {
    private static let encoder = JSONEncoder()
    private static let decoder = JSONDecoder()

    struct Enrollment: Codable, Equatable {
        let email: String
        let enrolledAt: TimeInterval
    }

    static var isEnrolled: Bool {
        KeychainStore.loadLocalOwnerEnrollment() != nil
    }

    static func enrollment() -> Enrollment? {
        guard let data = KeychainStore.loadLocalOwnerEnrollment() else { return nil }
        return try? decoder.decode(Enrollment.self, from: data)
    }

    static func enroll(email: String = "freddyv@duck.com") throws {
        let record = Enrollment(email: email, enrolledAt: Date().timeIntervalSince1970)
        try KeychainStore.saveLocalOwnerEnrollment(encoder.encode(record))
    }

    static func clear() {
        KeychainStore.removeLocalOwnerEnrollment()
    }
}
