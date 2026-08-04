import type {
  Event,
  EvidenceItem,
  Provenance,
  RoutedRequest,
} from "./types";

/**
 * The concise operational summary the Legacy Codex cognitive layer consumes.
 * Always derived, never stored — the routed_requests / evidence_items /
 * events tables stay the only source of truth. Every field that makes a
 * factual claim carries a provenance label, and absent data yields explicit
 * null / "none" / "unknown" states rather than invented text.
 */
export interface DerivedFoundryState {
  whatMattersNow: string | null;
  why: string | null;
  currentBlocker: string | null;
  nextAction: string | null;
  /** Provenance of nextAction — 'inference' until evidence verifies it. */
  nextActionProvenance: Provenance;
  evidenceState:
    | "none"
    | "pending"
    | "verified"
    | "unverified"
    | "conflict"
    | "stale";
  /** ISO timestamp of the newest event row, or null when no events exist. */
  lastTrustworthyUpdate: string | null;
  /** Provenance of the summary as a whole. */
  provenance: Provenance;
}

const EMPTY_STATE: DerivedFoundryState = {
  whatMattersNow: null,
  why: null,
  currentBlocker: null,
  nextAction: null,
  nextActionProvenance: "unknown",
  evidenceState: "none",
  lastTrustworthyUpdate: null,
  provenance: "unknown",
};

/**
 * The route that currently matters: the newest request that has not been
 * superseded or rejected. Corrections insert new rows, so following
 * created_at order over non-superseded rows always lands on the live route
 * while the full chain stays in history.
 */
export function activeRoute(requests: RoutedRequest[]): RoutedRequest | null {
  const live = requests
    .filter((r) => r.status !== "superseded" && r.status !== "rejected")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return live[0] ?? null;
}

/** Full correction chain for a request, oldest first. History is additive. */
export function correctionChain(
  requests: RoutedRequest[],
  requestId: string
): RoutedRequest[] {
  const byId = new Map(requests.map((r) => [r.id, r]));
  const chain: RoutedRequest[] = [];
  const visited = new Set<string>();
  let current = byId.get(requestId) ?? null;
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    chain.unshift(current);
    current = current.supersedes_request_id
      ? byId.get(current.supersedes_request_id) ?? null
      : null;
  }
  return chain;
}

function summarizeEvidence(
  items: EvidenceItem[]
): DerivedFoundryState["evidenceState"] {
  if (items.length === 0) return "none";
  if (items.some((item) => item.status === "conflict")) return "conflict";
  if (items.some((item) => item.status === "unverified")) return "unverified";
  if (items.some((item) => item.status === "stale")) return "stale";
  if (items.some((item) => item.status === "pending")) return "pending";
  if (items.some((item) => item.status === "verified")) return "verified";
  return "pending";
}

export function deriveFoundryState(
  requests: RoutedRequest[],
  evidence: EvidenceItem[],
  events: Event[]
): DerivedFoundryState {
  const route = activeRoute(requests);
  const latestEvent = events
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  if (!route) {
    return {
      ...EMPTY_STATE,
      lastTrustworthyUpdate: latestEvent?.created_at ?? null,
      // Rows read from the live database are runtime evidence even when the
      // route set is empty; a fully empty read stays unknown.
      provenance: latestEvent ? "runtime_evidence" : "unknown",
    };
  }

  const routeEvidence = evidence.filter(
    (item) => item.routed_request_id === route.id
  );
  const evidenceState = summarizeEvidence(routeEvidence);
  const fullyVerified = evidenceState === "verified";

  return {
    whatMattersNow: route.intent,
    why: route.rationale,
    currentBlocker:
      route.status === "blocked_policy"
        ? `Route blocked by policy (${route.risk} risk, ${route.sensitivity} sensitivity) — owner confirmation required`
        : null,
    // Until evidence verifies completion, the next action is verifying the
    // declared evidence requirement — labeled as inference, never as fact.
    nextAction: fullyVerified
      ? null
      : `Verify: ${route.required_evidence}`,
    nextActionProvenance: fullyVerified ? "verified" : "inference",
    evidenceState,
    lastTrustworthyUpdate: latestEvent?.created_at ?? null,
    provenance: "runtime_evidence",
  };
}
