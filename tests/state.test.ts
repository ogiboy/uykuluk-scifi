import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "../src/core/transitions";

describe("state transitions", () => {
  it("allows the safe MVP path", () => {
    expect(canTransition("NEW", "IDEAS_GENERATED")).toBe(true);
    expect(canTransition("IDEAS_GENERATED", "IDEA_APPROVED")).toBe(true);
    expect(canTransition("IDEA_APPROVED", "SCRIPT_GENERATED")).toBe(true);
    expect(canTransition("SCRIPT_REVIEWED", "SCRIPT_APPROVED")).toBe(true);
    expect(canTransition("SCRIPT_APPROVED", "PRODUCTION_PACKAGE_GENERATED")).toBe(true);
  });

  it("blocks skipped approval states", () => {
    expect(canTransition("IDEAS_GENERATED", "SCRIPT_GENERATED")).toBe(false);
    expect(canTransition("SCRIPT_GENERATED", "PRODUCTION_PACKAGE_GENERATED")).toBe(false);
    expect(() => assertTransition("READY_FOR_MANUAL_PRODUCTION", "SCHEDULED_OR_PUBLIC")).toThrow(
      /Transition blocked/,
    );
  });
});
