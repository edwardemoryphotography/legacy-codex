import { describe, expect, it } from "vitest";
import {
  activeRoute,
  correctionChain,
  deriveFoundryState,
} from "../../foundry-console/src/lib/derived-state";
import type {
  Event,
  EvidenceItem,
  RoutedRequest,
} from "../../foundry-console/src/lib/types";

function request(overrides: Partial<RoutedRequest>): RoutedRequest {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    workspace_id: "00000000-0000-0000-0000-0000000000aa",
    action_id: null,
    supersedes_request_id: null,
    intent: "Review the Legacy Codex repository and identify stale project documentation.",
    task_type: "review",
    execution_lane: "documentation",
    selected_agent: "claude-code",
    repository: "edwardemoryphotography/legacy-codex",
    repository_path: null,
    risk: "low",
    sensitivity: "internal",
    required_evidence: "A reviewed list of stale documentation with file paths",
    rationale: "Documentation review routes to the documentation lane.",
    confidence: 80,
    status: "confirmed",
    route_source: "model",
    provenance: "inference",
    created_at: "2026-08-04T01:00:00.000Z",
    updated_at: "2026-08-04T01:00:00.000Z",
    ...overrides,
  };
}

function evidenceItem(overrides: Partial<EvidenceItem>): EvidenceItem {
  return {
    id: "00000000-0000-0000-0000-0000000000e1",
    workspace_id: "00000000-0000-0000-0000-0000000000aa",
    routed_request_id: "00000000-0000-0000-0000-000000000001",
    action_id: null,
    kind: "confirmed_action",
    status: "pending",
    claim: "Stale documentation list produced and reviewed",
    source: null,
    observed_at: null,
    provenance: "unknown",
    created_at: "2026-08-04T01:00:01.000Z",
    updated_at: "2026-08-04T01:00:01.000Z",
    ...overrides,
  };
}

describe("deriveFoundryState — honest empty states", () => {
  it("returns nulls and unknown provenance when the database is empty", () => {
    const state = deriveFoundryState([], [], []);
    expect(state.whatMattersNow).toBeNull();
    expect(state.why).toBeNull();
    expect(state.currentBlocker).toBeNull();
    expect(state.nextAction).toBeNull();
    expect(state.evidenceState).toBe("none");
    expect(state.lastTrustworthyUpdate).toBeNull();
    expect(state.provenance).toBe("unknown");
  });

  it("never fabricates a summary from zero routes even when events exist", () => {
    const events: Event[] = [
      {
        id: "ev1",
        workspace_id: "00000000-0000-0000-0000-0000000000aa",
        actor_id: null,
        action: "workspace.created",
        target_type: null,
        target_id: null,
        metadata: null,
        created_at: "2026-08-04T00:00:00.000Z",
      },
    ];
    const state = deriveFoundryState([], [], events);
    expect(state.whatMattersNow).toBeNull();
    expect(state.lastTrustworthyUpdate).toBe("2026-08-04T00:00:00.000Z");
    expect(state.provenance).toBe("runtime_evidence");
  });
});

describe("deriveFoundryState — pending evidence gates the next action", () => {
  it("starts with pending evidence and an inference-labeled verification step", () => {
    const state = deriveFoundryState(
      [request({})],
      [evidenceItem({})],
      []
    );
    expect(state.whatMattersNow).toContain("stale project documentation");
    expect(state.evidenceState).toBe("pending");
    expect(state.nextAction).toBe(
      "Verify: A reviewed list of stale documentation with file paths"
    );
    expect(state.nextActionProvenance).toBe("inference");
  });

  it("only reports verified once a real observation backs the evidence", () => {
    const state = deriveFoundryState(
      [request({})],
      [
        evidenceItem({
          status: "verified",
          source: "https://github.com/edwardemoryphotography/legacy-codex/pull/999",
          observed_at: "2026-08-04T02:00:00.000Z",
          provenance: "repository_evidence",
        }),
      ],
      []
    );
    expect(state.evidenceState).toBe("verified");
    expect(state.nextAction).toBeNull();
    expect(state.nextActionProvenance).toBe("verified");
  });

  it("surfaces conflicts over any other evidence state", () => {
    const state = deriveFoundryState(
      [request({})],
      [
        evidenceItem({ id: "e-a", status: "verified", source: "x", observed_at: "2026-08-04T02:00:00.000Z", provenance: "runtime_evidence" }),
        evidenceItem({ id: "e-b", status: "conflict" }),
      ],
      []
    );
    expect(state.evidenceState).toBe("conflict");
  });
});

describe("route corrections append history", () => {
  const original = request({
    id: "00000000-0000-0000-0000-000000000001",
    status: "superseded",
    created_at: "2026-08-04T01:00:00.000Z",
  });
  const correction = request({
    id: "00000000-0000-0000-0000-000000000002",
    supersedes_request_id: original.id,
    execution_lane: "research",
    status: "corrected",
    route_source: "user",
    created_at: "2026-08-04T01:30:00.000Z",
  });

  it("the correction becomes the active route without deleting the original", () => {
    const requests = [original, correction];
    expect(activeRoute(requests)?.id).toBe(correction.id);
    // The original is still present in the input set — history preserved.
    expect(requests.map((r) => r.id)).toContain(original.id);
  });

  it("the correction chain resolves oldest-first with both rows intact", () => {
    const chain = correctionChain([original, correction], correction.id);
    expect(chain.map((r) => r.id)).toEqual([original.id, correction.id]);
    expect(chain[0].execution_lane).toBe("documentation");
    expect(chain[1].execution_lane).toBe("research");
  });

  it("a superseded route never becomes the active route", () => {
    expect(activeRoute([original])).toBeNull();
  });
});

describe("policy-blocked routes surface as the current blocker", () => {
  it("labels the blocker with risk and sensitivity", () => {
    const state = deriveFoundryState(
      [request({ status: "blocked_policy", risk: "high", sensitivity: "private" })],
      [],
      []
    );
    expect(state.currentBlocker).toContain("high risk");
    expect(state.currentBlocker).toContain("private sensitivity");
  });
});
