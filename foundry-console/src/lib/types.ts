export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "admin" | "member";
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
