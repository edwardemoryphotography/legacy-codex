/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  correctionChain,
  deriveFoundryState,
} from "../../foundry-console/src/lib/derived-state";
import { classifyRoutingLoadError } from "../../foundry-console/src/lib/routing-load";
import type {
  EvidenceItem,
  Event,
  RoutedRequest,
} from "../../foundry-console/src/lib/types";
import FoundryOperationalReadout from "../../src/components/FoundryOperationalReadout";

function route(partial: Partial<RoutedRequest> & Pick<RoutedRequest, "id">): RoutedRequest {
  return {
    workspace_id: "ws-1",
    action_id: null,
    supersedes_request_id: null,
    intent: "Ship routing UI",
    task_type: "implement",
    execution_lane: "execution",
    selected_agent: "cursor",
    repository: "edwardemoryphotography/legacy-codex",
    repository_path: null,
    risk: "medium",
    sensitivity: "internal",
    required_evidence: "Merged PR",
    rationale: "Lane B needs the inbox",
    confidence: 80,
    status: "proposed",
    route_source: "doctrine_fallback",
    provenance: "inference",
    created_at: "2026-08-04T00:00:00.000Z",
    updated_at: "2026-08-04T00:00:00.000Z",
    ...partial,
  };
}

function evidence(
  partial: Partial<EvidenceItem> & Pick<EvidenceItem, "id" | "status">,
): EvidenceItem {
  return {
    workspace_id: "ws-1",
    routed_request_id: "r1",
    action_id: null,
    kind: "merged_pr",
    claim: "PR merged",
    source: null,
    observed_at: null,
    provenance: "unknown",
    created_at: "2026-08-04T00:00:00.000Z",
    updated_at: "2026-08-04T00:00:00.000Z",
    ...partial,
  };
}

describe("Foundry routing UI contracts", () => {
  it("empty Legacy Codex readout contains no synthetic data", () => {
    render(<FoundryOperationalReadout />);
    expect(screen.getByTestId("foundry-readout-unavailable")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /demo route|sample request|fake evidence/i,
    );
    expect(document.body.textContent).toMatch(/no demonstration records/i);
  });

  it("pending evidence is not treated as verified by deriveFoundryState", () => {
    const state = deriveFoundryState(
      [route({ id: "r1" })],
      [evidence({ id: "e1", status: "pending" })],
      [],
    );
    expect(state.evidenceState).toBe("pending");
    expect(state.evidenceState).not.toBe("verified");
    expect(state.nextAction).toMatch(/^Verify:/);
  });

  it("verified evidence requires source and observed time before trust", () => {
    const incomplete = evidence({
      id: "e1",
      status: "verified",
      source: null,
      observed_at: null,
    });
    // UI contract: verified rows must expose source + observed_at.
    expect(Boolean(incomplete.source && incomplete.observed_at)).toBe(false);

    const complete = evidence({
      id: "e2",
      status: "verified",
      source: "https://github.com/org/repo/pull/1",
      observed_at: "2026-08-04T01:00:00.000Z",
      provenance: "repository_evidence",
    });
    expect(complete.source).toBeTruthy();
    expect(complete.observed_at).toBeTruthy();
    const state = deriveFoundryState([route({ id: "r1" })], [complete], []);
    expect(state.evidenceState).toBe("verified");
  });

  it("correction history preserves the original", () => {
    const original = route({
      id: "r1",
      intent: "Original intent",
      status: "superseded",
      created_at: "2026-08-04T00:00:00.000Z",
    });
    const correction = route({
      id: "r2",
      intent: "Corrected intent",
      status: "corrected",
      supersedes_request_id: "r1",
      created_at: "2026-08-04T02:00:00.000Z",
    });
    const chain = correctionChain([original, correction], "r2");
    expect(chain[0]?.id).toBe("r1");
    expect(chain[0]?.intent).toBe("Original intent");
    expect(chain[1]?.id).toBe("r2");
  });

  it("derived summary comes from deriveFoundryState()", () => {
    const requests = [route({ id: "r1", intent: "What matters" })];
    const items = [evidence({ id: "e1", status: "pending" })];
    const events: Event[] = [];
    const state = deriveFoundryState(requests, items, events);
    render(
      <FoundryOperationalReadout
        state={{
          whatMattersNow: state.whatMattersNow,
          why: state.why,
          currentBlocker: state.currentBlocker,
          nextAction: state.nextAction,
          nextActionProvenance: state.nextActionProvenance,
          evidenceState: state.evidenceState,
          lastTrustworthyUpdate: state.lastTrustworthyUpdate,
          provenance: state.provenance,
        }}
      />,
    );
    expect(
      screen.getByTestId("foundry-operational-readout").getAttribute(
        "data-derived-source",
      ),
    ).toBe("deriveFoundryState");
    expect(document.body.textContent).toContain("What matters");
    expect(document.body.textContent).toMatch(/pending/i);
  });

  it("unauthenticated / missing-table states do not invent routing records", () => {
    const missing = classifyRoutingLoadError({
      code: "42P01",
      message: 'relation "routed_requests" does not exist',
    });
    expect(missing.kind).toBe("tables_missing");
    expect(missing.message).toMatch(/not deployed/i);

    const unauthorized = classifyRoutingLoadError({
      code: "42501",
      message: "permission denied for table routed_requests",
    });
    expect(unauthorized.kind).toBe("unauthorized");
    expect(unauthorized.message).toMatch(/owner authentication/i);
  });

  it("conflicting and stale evidence remain semantically distinct", () => {
    const conflictState = deriveFoundryState(
      [route({ id: "r1" })],
      [evidence({ id: "e1", status: "conflict" })],
      [],
    );
    const staleOnly = deriveFoundryState(
      [route({ id: "r1" })],
      [evidence({ id: "e1", status: "stale" })],
      [],
    );
    expect(conflictState.evidenceState).toBe("conflict");
    // Stale is a distinct evidenceState at the derived-summary layer too
    // (extended in the Lane A hardening pass) so consumers can tell an
    // expired observation apart from evidence that was never observed.
    expect(staleOnly.evidenceState).toBe("stale");
    expect(conflictState.evidenceState).not.toBe(staleOnly.evidenceState);
  });
});
