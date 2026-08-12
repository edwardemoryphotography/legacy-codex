export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface Sprint {
  id: string;
  workspace_id: string;
  title: string;
  goal: string | null;
  status: "planned" | "active" | "completed" | "cancelled";
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FrictionEntry {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved" | "wontfix";
  created_by: string | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ManualPage {
  id: string;
  workspace_id: string;
  title: string;
  content: string | null;
  version: number;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface Settings {
  id: string;
  workspace_id: string;
  kill_switch_ai: boolean;
  pii_warning_enabled: boolean;
  updated_at: string;
}

export interface Event {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Routing control plane (supabase/migrations/20260804010000) ────────────

export type ExecutionLane =
  | "execution"
  | "research"
  | "architecture"
  | "deployment"
  | "documentation"
  | "system_state"
  | "override";

export type RouteStatus =
  | "proposed"
  | "confirmed"
  | "corrected"
  | "superseded"
  | "rejected"
  | "blocked_policy";

export type RouteSource = "model" | "doctrine_fallback" | "user";

export type Provenance =
  | "verified"
  | "repository_evidence"
  | "runtime_evidence"
  | "user_confirmed"
  | "inference"
  | "concept"
  | "unknown";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type Sensitivity = "public" | "internal" | "private" | "restricted";

export interface RoutedRequest {
  id: string;
  workspace_id: string;
  action_id: string | null;
  supersedes_request_id: string | null;
  intent: string;
  task_type: string;
  execution_lane: ExecutionLane;
  selected_agent: string;
  repository: string;
  repository_path: string | null;
  risk: RiskLevel;
  sensitivity: Sensitivity;
  required_evidence: string;
  rationale: string;
  confidence: number;
  status: RouteStatus;
  route_source: RouteSource;
  provenance: Provenance;
  created_at: string;
  updated_at: string;
}

export type EvidenceKind =
  | "merged_pr"
  | "live_deployment"
  | "published_artifact"
  | "confirmed_action"
  | "test_run"
  | "custom";

export type EvidenceStatus =
  | "pending"
  | "verified"
  | "unverified"
  | "conflict"
  | "stale";

export interface EvidenceItem {
  id: string;
  workspace_id: string;
  routed_request_id: string | null;
  action_id: string | null;
  kind: EvidenceKind;
  status: EvidenceStatus;
  claim: string;
  source: string | null;
  observed_at: string | null;
  provenance: Provenance;
  created_at: string;
  updated_at: string;
}
