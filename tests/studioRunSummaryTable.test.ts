import { describe, expect, it } from "vitest";
import { formatRunReviewCounts } from "../apps/studio/src/lib/runSummaryCopy";

describe("Studio run summary table copy", () => {
  it("formats approval, warning, and artifact counts for the run index", () => {
    expect(formatRunReviewCounts({ approvalCount: 2, artifactCount: 9, warningCount: 1 })).toBe(
      "2 approvals · 1 warnings · 9 artifacts",
    );
  });
});
