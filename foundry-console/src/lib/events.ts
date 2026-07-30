import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/errors";

export type LogEventResult =
  | { ok: true }
  | { ok: false; error: string };

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
): Promise<LogEventResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("events").insert({
      workspace_id: workspaceId,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      metadata: metadata ?? null,
    });
    if (error) return { ok: false, error: getErrorMessage(error) };
    return { ok: true };
  } catch (error) {
    // Audit logging must never break the UI.
    return { ok: false, error: getErrorMessage(error) };
  }
}
