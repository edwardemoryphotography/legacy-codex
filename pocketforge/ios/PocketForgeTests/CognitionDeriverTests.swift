import XCTest
@testable import PocketForge

final class CognitionDeriverTests: XCTestCase {
    func testLARSeparatesNowNextAndBlockedWithoutInventingActions() {
        let now = route(id: 1, status: "confirmed", createdAt: "2026-08-07T03:00:00Z")
        let next = route(id: 2, status: "confirmed", createdAt: "2026-08-07T02:00:00Z")
        let blocked = route(id: 3, status: "blocked_policy", createdAt: "2026-08-07T04:00:00Z")

        let state = CognitionDeriver.lar(routes: [next, blocked, now], evidence: [])

        XCTAssertEqual(state.now?.id, now.id)
        XCTAssertEqual(state.next.map(\.id), [next.id])
        XCTAssertEqual(state.blocked.map(\.id), [blocked.id])
        XCTAssertEqual(state.nextPhysicalTarget, now.requiredEvidence)
    }

    func testVerifiedEvidenceClearsTheVerificationTarget() {
        let current = route(id: 1, status: "confirmed", createdAt: "2026-08-07T03:00:00Z")
        let item = EvidenceRecord(
            id: uuid(20),
            routedRequestID: current.id,
            actionID: nil,
            status: "verified",
            claim: current.requiredEvidence,
            source: "https://example.com/observed",
            observedAt: "2026-08-07T03:30:00Z",
            provenance: "runtime_evidence"
        )

        XCTAssertNil(CognitionDeriver.lar(routes: [current], evidence: [item]).nextPhysicalTarget)
    }

    func testIncompleteVerifiedClaimRemainsUnverified() {
        let current = route(id: 1, status: "confirmed", createdAt: "2026-08-07T03:00:00Z")
        let item = EvidenceRecord(
            id: uuid(20),
            routedRequestID: current.id,
            actionID: nil,
            status: "verified",
            claim: current.requiredEvidence,
            source: nil,
            observedAt: nil,
            provenance: "unknown"
        )

        XCTAssertEqual(
            CognitionDeriver.lar(routes: [current], evidence: [item]).nextPhysicalTarget,
            current.requiredEvidence
        )
    }

    private func route(id: Int, status: String, createdAt: String) -> RoutedRequestRecord {
        RoutedRequestRecord(
            id: uuid(id),
            workspaceID: uuid(99),
            actionID: nil,
            intent: "Real route \(id)",
            taskType: "implementation",
            executionLane: "execution",
            selectedAgent: "foundry",
            repository: "owner/repository",
            repositoryPath: nil,
            risk: "medium",
            sensitivity: "private",
            requiredEvidence: "Observed evidence \(id)",
            rationale: "User confirmed route",
            confidence: 100,
            status: status,
            provenance: "user_confirmed",
            createdAt: createdAt
        )
    }

    private func uuid(_ value: Int) -> UUID {
        UUID(uuidString: String(format: "00000000-0000-0000-0000-%012d", value))!
    }
}
