/**
 * Classify Supabase/PostgREST failures for the routing control plane tables.
 * Honest empty/unavailable states — never seed demonstration records.
 */

export type RoutingLoadKind =
  | "ok"
  | "tables_missing"
  | "unavailable"
  | "unauthorized"
  | "unknown";

export function classifyRoutingLoadError(error: unknown): {
  kind: RoutingLoadKind;
  message: string;
} {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : "Unknown error";

  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (
    code === "42P01" ||
    /relation .* does not exist/i.test(message) ||
    /could not find the table/i.test(message) ||
    /routed_requests/i.test(message) && /does not exist|schema cache/i.test(message)
  ) {
    return {
      kind: "tables_missing",
      message:
        "Routing tables are not deployed. Apply supabase/migrations/20260804010000_routing_control_plane.sql before Foundry can read routed requests or evidence.",
    };
  }

  if (
    code === "42501" ||
    /permission denied|row-level security|JWT|not authenticated|unauthorized/i.test(
      message,
    )
  ) {
    return {
      kind: "unauthorized",
      message:
        "Owner authentication is required. Sign in with the Foundry owner account to read routing records under RLS.",
    };
  }

  if (/Failed to fetch|NetworkError|fetch failed|timeout/i.test(message)) {
    return {
      kind: "unavailable",
      message:
        "Backend is unavailable. Check NEXT_PUBLIC_SUPABASE_URL / network connectivity and retry.",
    };
  }

  return { kind: "unknown", message };
}
