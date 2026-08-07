import Foundation
import LocalAuthentication

protocol BiometricAuthenticating: Sendable {
    func authenticate() async throws
}

struct FaceIDAuthenticator: BiometricAuthenticating {
    func authenticate() async throws {
        let context = LAContext()
        context.localizedCancelTitle = "Keep Locked"

        var evaluationError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &evaluationError) else {
            throw BiometricAuthenticationError.unavailable(
                evaluationError?.localizedDescription ?? "Face ID is not available on this iPhone."
            )
        }

        do {
            let accepted = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Unlock your private Legacy Codex."
            )
            guard accepted else { throw BiometricAuthenticationError.rejected }
        } catch {
            throw BiometricAuthenticationError.failed(error.localizedDescription)
        }
    }
}

enum BiometricAuthenticationError: LocalizedError {
    case unavailable(String)
    case rejected
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .unavailable(let message): message
        case .rejected: "Face ID did not unlock PocketForge."
        case .failed(let message): "Face ID did not unlock PocketForge: \(message)"
        }
    }
}
