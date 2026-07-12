import { describe, expect, it } from "vitest";
import { summarizeStudioMutationRecord } from "../apps/studio/src/lib/mutations/studioMutationResultSummary";

describe("Studio mutation result summaries", () => {
  it("formats primitive state, identity, count, and next-action facts", () => {
    expect(
      summarizeStudioMutationRecord({
        artifacts: ["script.md", "reviews/script_review.json"],
        decision: "needs-revision",
        invalidatedArtifacts: ["reviews/script_review.json"],
        refreshedArtifacts: ["script.meta.json"],
        nextSafeAction: "pnpm producer evidence --run run_summary",
        nextState: "SCRIPT_GENERATED",
        previousState: "SCRIPT_REVIEWED",
        runId: "run_summary",
      }),
    ).toEqual({
      facts: [
        "State: SCRIPT_REVIEWED → SCRIPT_GENERATED",
        "Run: run_summary",
        "Decision: needs-revision",
        "Artifacts: 2",
        "Invalidated: 1",
        "Refreshed: 1",
        "Next action: pnpm producer evidence --run run_summary",
      ],
      runId: "run_summary",
    });
  });

  it("ignores non-primitive records instead of stringifying objects", () => {
    expect(
      summarizeStudioMutationRecord({ nested: { unsafe: true }, runId: "run_summary" }),
    ).toEqual({ facts: ["Run: run_summary"], runId: "run_summary" });
    expect(summarizeStudioMutationRecord({ nested: { unsafe: true } })).toBeNull();
  });
});
