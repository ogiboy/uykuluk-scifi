import { describe, expect, it } from "vitest";
import type { StudioArtifactPreview } from "../apps/studio/src/lib/artifactPreviews";
import { buildArtifactReviewHandoff } from "../apps/studio/src/lib/artifactReviewHandoff";

describe("Studio artifact review handoff", () => {
  it("orders local review milestones and reports the next missing focus", () => {
    const handoff = buildArtifactReviewHandoff([
      artifactPreview("reviews/script_review.md", "Script review", true),
      artifactPreview("production/storyboard_contact_sheet.md", "Storyboard contact sheet", true),
      artifactPreview("production/audio/voiceover_review.md", "Voiceover review", false),
    ]);

    expect(handoff).toMatchObject({
      availableCount: 2,
      nextFocus: {
        label: "Voiceover review",
        path: "production/audio/voiceover_review.md",
      },
      totalCount: 6,
    });
    expect(handoff.milestones.map((milestone) => milestone.path)).toEqual([
      "reviews/script_review.md",
      "production/storyboard_contact_sheet.md",
      "production/audio/voiceover_review.md",
      "production/render/draft_review.md",
      "production/review_bundle.md",
      "production/channel_handoff.md",
    ]);
  });

  it("marks the handoff complete when every review document exists", () => {
    const handoff = buildArtifactReviewHandoff([
      artifactPreview("reviews/script_review.md", "Script review", true),
      artifactPreview("production/storyboard_contact_sheet.md", "Storyboard contact sheet", true),
      artifactPreview("production/audio/voiceover_review.md", "Voiceover review", true),
      artifactPreview("production/render/draft_review.md", "Draft render review", true),
      artifactPreview("production/review_bundle.md", "Final review handoff", true),
      artifactPreview("production/channel_handoff.md", "Manual channel handoff", true),
    ]);

    expect(handoff.availableCount).toBe(6);
    expect(handoff.nextFocus).toBeNull();
  });
});

function artifactPreview(path: string, label: string, exists: boolean): StudioArtifactPreview {
  return {
    description: `${label} description.`,
    exists,
    group: "Audio And Render",
    kind: "markdown",
    label,
    operatorAction: `${label} action.`,
    path,
    preview: exists ? `${label} preview.` : null,
    previewTruncated: false,
    sizeBytes: exists ? 128 : null,
  };
}
