import { describe, expect, it } from "vitest";
import {
  buildExportPayload,
  createExportFilename,
  EXPORT_DATASETS,
} from "../../foundry-console/src/lib/export";

const emptySuccessfulResults: Parameters<typeof buildExportPayload>[2] =
  EXPORT_DATASETS.map(() => ({
    data: [],
    error: null,
  }));

describe("Foundry export integrity", () => {
  it("includes every workspace dataset in a valid JSON payload", () => {
    const payload = buildExportPayload(
      { id: "workspace-id", name: "Owner Workspace" },
      "2026-07-13T08:00:00.000Z",
      emptySuccessfulResults
    );

    expect(EXPORT_DATASETS).toEqual([
      "sprints",
      "friction_entries",
      "milestones",
      "manual",
      "settings",
      "events",
      "routed_requests",
      "evidence_items",
    ]);
    expect(Object.keys(JSON.parse(JSON.stringify(payload)))).toEqual([
      "workspace",
      "exported_at",
      ...EXPORT_DATASETS,
    ]);
  });

  it("fails closed when any required dataset query fails", () => {
    const failedResults = [...emptySuccessfulResults];
    failedResults[3] = {
      data: [],
      error: { message: "Manual query denied" },
    };

    expect(() =>
      buildExportPayload(
        { id: "workspace-id", name: "Owner Workspace" },
        "2026-07-13T08:00:00.000Z",
        failedResults
      )
    ).toThrow("Manual query denied");
  });

  it("tolerates missing routed_requests/evidence_items on installs that only ran SCHEMA.sql", () => {
    const results = [...emptySuccessfulResults];
    results[6] = { data: null, error: { message: "relation \"public.routed_requests\" does not exist", code: "42P01" } };
    results[7] = { data: null, error: { message: "relation \"public.evidence_items\" does not exist", code: "42P01" } };

    const payload = buildExportPayload(
      { id: "workspace-id", name: "Owner Workspace" },
      "2026-07-13T08:00:00.000Z",
      results
    ) as Record<string, unknown>;

    expect(payload.routed_requests).toEqual([]);
    expect(payload.evidence_items).toEqual([]);
  });

  it("still fails closed on an undefined-table error for a required (non-optional) dataset", () => {
    const failedResults = [...emptySuccessfulResults];
    failedResults[3] = {
      data: null,
      error: { message: "relation \"public.manual\" does not exist", code: "42P01" },
    };

    expect(() =>
      buildExportPayload(
        { id: "workspace-id", name: "Owner Workspace" },
        "2026-07-13T08:00:00.000Z",
        failedResults
      )
    ).toThrow("public.manual");
  });

  it("creates a deterministic filename without path or control characters", () => {
    expect(
      createExportFilename(" ../Owner / Workspace\u0000 ", "2026-07-13T08:00:00.000Z")
    ).toBe("owner_workspace_export_2026-07-13.json");
  });
});
