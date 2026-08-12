import { describe, expect, it } from "vitest";
import { createRequestGate } from "../../foundry-console/src/lib/request-gate";

describe("createRequestGate", () => {
  it("allows only the newest request token to update state", () => {
    const gate = createRequestGate();
    const first = gate.begin();
    const second = gate.begin();

    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
  });

  it("invalidates the active request during cleanup", () => {
    const gate = createRequestGate();
    const request = gate.begin();

    gate.invalidate();

    expect(gate.isCurrent(request)).toBe(false);
  });

  it("rejects a late request that belongs to a previous workspace", () => {
    const gate = createRequestGate();
    gate.setScope("workspace-a");
    gate.setScope("workspace-b");

    const lateWorkspaceARequest = gate.begin();

    expect(gate.isCurrent(lateWorkspaceARequest, "workspace-a")).toBe(false);
    expect(gate.isCurrent(lateWorkspaceARequest, "workspace-b")).toBe(true);
  });
});
