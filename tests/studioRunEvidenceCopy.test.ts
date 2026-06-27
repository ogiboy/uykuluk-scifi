import { describe, expect, it } from "vitest";
import {
  blockedActionsEmptyMessage,
  blockedActionsIntro,
  productionMediaIntro,
  shouldShowEvidenceRemediation,
} from "../apps/studio/src/lib/runEvidenceCopy";

describe("Studio run evidence copy", () => {
  it("allows no-blocker copy only when evidence is current", () => {
    expect(blockedActionsIntro("available")).toContain("current CLI/core safeguard bundle");
    expect(blockedActionsEmptyMessage("available")).toBe(
      "No blocked actions recorded in the latest evidence bundle.",
    );
    expect(shouldShowEvidenceRemediation("available")).toBe(false);
  });

  it("does not treat unavailable evidence as proof that actions are unblocked", () => {
    expect(blockedActionsIntro("stale")).toContain("does not infer that actions are unblocked");
    expect(blockedActionsEmptyMessage("stale")).toBe(
      "Regenerate evidence before treating blocked-action status as review proof.",
    );
    expect(shouldShowEvidenceRemediation("missing")).toBe(true);
    expect(shouldShowEvidenceRemediation("invalid")).toBe(true);
  });

  it("labels production-media fallback as artifact-record evidence until evidence is current", () => {
    expect(productionMediaIntro("available")).toContain("current CLI evidence bundle");
    expect(productionMediaIntro("stale")).toContain("fallback from persisted artifact records");
  });
});
