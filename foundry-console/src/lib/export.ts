import { firstResultError } from "./errors";

export const EXPORT_DATASETS = [
  "sprints",
  "friction_entries",
  "milestones",
  "manual",
  "settings",
  "events",
] as const;

interface ExportWorkspace {
  id: string;
  name: string;
}

interface ExportQueryResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

export function buildExportPayload(
  workspace: ExportWorkspace,
  exportedAt: string,
  results: readonly ExportQueryResult[]
) {
  if (results.length !== EXPORT_DATASETS.length) {
    throw new Error("Export did not fetch every required dataset.");
  }

  const queryError = firstResultError(results);
  if (queryError) throw new Error(queryError.message);

  return EXPORT_DATASETS.reduce<Record<string, unknown>>(
    (payload, dataset, index) => {
      payload[dataset] = results[index].data ?? [];
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
