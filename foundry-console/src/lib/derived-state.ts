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
    | "conflict"
    | "stale"
    | "unverified";
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
  let current = byId.get(requestId) ?? null;
  while (current) {
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
  if (items.some((item) => item.status === "verified")) return "verified";
  // Both are checked-and-resolved outcomes, distinct from a never-observed
  // 'pending' row: 'stale' means evidence existed and expired, 'unverified'
  // means it was checked and did not confirm the claim. Collapsing either
  // into 'pending' would tell consumers nothing was ever observed.
  if (items.some((item) => item.status === "stale")) return "stale";
  if (items.some((item) => item.status === "unverified")) return "unverified";
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
  // Gate on the summarized state, not the presence of any verified row: a
  // route with both a verified item and a conflict item reports
  // evidenceState 'conflict' (conflict wins), and nextAction must agree —
  // clearing it here would tell the cognitive layer "conflict" and
  // "verified, nothing to do" at the same time.
  const verified = evidenceState === "verified";
  const blockedByPolicy = route.status === "blocked_policy";

  // Policy block is a prior gate to evidence verification, not a peer step:
  // if the route itself is on hold pending owner confirmation, nextAction
  // must say so instead of pointing consumers at the (irrelevant, until the
  // block clears) evidence-verification path.
  let nextAction: string | null;
  if (blockedByPolicy) {
    nextAction = `Resolve policy block before verification: owner confirmation required (${route.risk} risk, ${route.sensitivity} sensitivity)`;
  } else if (verified) {
    nextAction = null;
  } else if (evidenceState === "stale") {
    nextAction = `Re-verify (evidence expired): ${route.required_evidence}`;
  } else if (evidenceState === "unverified") {
    nextAction = `Re-check (evidence did not confirm): ${route.required_evidence}`;
  } else {
    nextAction = `Verify: ${route.required_evidence}`;
  }

  return {
    whatMattersNow: route.intent,
    why: route.rationale,
    currentBlocker: blockedByPolicy
      ? `Route blocked by policy (${route.risk} risk, ${route.sensitivity} sensitivity) — owner confirmation required`
      : null,
    nextAction,
    // Never a fact until evidence actually verifies the route, and a
    // policy block is inherently an inferred next step too.
    nextActionProvenance: verified && !blockedByPolicy ? "verified" : "inference",
    evidenceState,
    lastTrustworthyUpdate: latestEvent?.created_at ?? null,
    provenance: "runtime_evidence",
  };
}
