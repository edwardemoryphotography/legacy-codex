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
});
