import type { StudioArtifactPreview } from "../apps/studio/src/lib/artifactPreviews";

export function studioArtifactPreview(
  overrides: Partial<StudioArtifactPreview>,
): StudioArtifactPreview {
  return {
    description: "Artifact description.",
    exists: true,
    group: "Script Review",
    kind: "markdown",
    label: "Script review",
    operatorAction: "Review locally.",
    path: "reviews/script_review.md",
    preview: "Preview.",
    previewTruncated: false,
    sizeBytes: 128,
    ...overrides,
  };
}
