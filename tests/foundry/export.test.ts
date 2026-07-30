import { describe, expect, it } from "vitest";
import {
  buildExportPayload,
  createExportFilename,
  EXPORT_DATASETS,
} from "../../foundry-console/src/lib/export";

const emptySuccessfulResults = EXPORT_DATASETS.map(() => ({
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

  it("creates a deterministic filename without path or control characters", () => {
    expect(
      createExportFilename(" ../Owner / Workspace\u0000 ", "2026-07-13T08:00:00.000Z")
    ).toBe("owner_workspace_export_2026-07-13.json");
  });
});
