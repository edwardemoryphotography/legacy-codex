import { firstResultError } from "./errors";

export const EXPORT_DATASETS = [
  "sprints",
  "friction_entries",
  "milestones",
  "manual",
  "settings",
  "events",
  "routed_requests",
  "evidence_items",
] as const;

interface ExportWorkspace {
  id: string;
  name: string;
}

interface ExportQueryResult {
  data: unknown[] | null;
  error: { message: string; code?: string } | null;
}

// Postgres/PostgREST code for "relation does not exist". Installs that
// only ran SCHEMA.sql (README.md's documented setup) and never applied
// the routing-control-plane migrations don't have these two tables yet --
// treat that specific, identifiable error as "no rows" instead of failing
// the whole export closed, the way any real query error still must.
const UNDEFINED_TABLE = "42P01";
const OPTIONAL_DATASETS: ReadonlySet<string> = new Set([
  "routed_requests",
  "evidence_items",
]);

export function buildExportPayload(
  workspace: ExportWorkspace,
  exportedAt: string,
  results: readonly ExportQueryResult[]
) {
  if (results.length !== EXPORT_DATASETS.length) {
    throw new Error("Export did not fetch every required dataset.");
  }

  const normalized = results.map((result, index) =>
    result.error?.code === UNDEFINED_TABLE &&
    OPTIONAL_DATASETS.has(EXPORT_DATASETS[index])
      ? { data: [], error: null }
      : result
  );

  const queryError = firstResultError(normalized);
  if (queryError) throw new Error(queryError.message);

  return EXPORT_DATASETS.reduce<Record<string, unknown>>(
    (payload, dataset, index) => {
      payload[dataset] = normalized[index].data ?? [];
      return payload;
    },
    { workspace, exported_at: exportedAt }
  );
}

export function createExportFilename(workspaceName: string, exportedAt: string) {
  const safeWorkspaceName = workspaceName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  const date = new Date(exportedAt).toISOString().slice(0, 10);

  return `${safeWorkspaceName || "workspace"}_export_${date}.json`;
}
