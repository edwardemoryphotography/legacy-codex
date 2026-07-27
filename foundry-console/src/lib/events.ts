import { createClient } from "@/lib/supabase/client";

/**
 * Append an entry to the audit log. Fire-and-forget: audit failures
 * never block the primary action.
 */
export async function logEvent(
  workspaceId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    const supabase = createClient();
    await supabase.from("events").insert({
      workspace_id: workspaceId,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      metadata: metadata ?? null,
    });
  } catch {
    // Audit logging must never break the UI.
  }
}
