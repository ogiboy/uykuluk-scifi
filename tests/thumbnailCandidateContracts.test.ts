import { describe, expect, it } from "vitest";
import { thumbnailCandidatePackSchema } from "../src/stages/thumbnailCandidateContracts";

describe("thumbnail candidate contracts", () => {
  it("rejects packs whose recommended candidate id is not present", () => {
    const result = thumbnailCandidatePackSchema.safeParse({
      blockedActions: ["No upload approval."],
      candidates: [
        {
          id: "thumbnail-01-left",
          reviewFocus: "Check title-safe area.",
          template: {
            digest: "a".repeat(64),
            path: "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg",
            role: "thumbnail-template",
          },
        },
      ],
      operatorNotes: ["Pick manually."],
      recommendedCandidateId: "thumbnail-missing",
      runId: "run_test",
      schemaVersion: 1,
      source: {
        finalReviewBundleDigest: "b".repeat(64),
        finalReviewBundlePath: "production/review_bundle.json",
      },
    });

    expect(result.success).toBe(false);
    expect(String(result.error?.issues[0]?.message)).toContain("recommendedCandidateId");
  });
});
