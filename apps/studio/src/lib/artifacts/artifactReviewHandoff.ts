import type { StudioArtifactPreview } from "./artifactPreviews";

export type StudioArtifactReviewMilestone = Readonly<{
  action: string;
  available: boolean;
  label: string;
  path: string;
}>;

export type StudioArtifactReviewHandoff = Readonly<{
  availableCount: number;
  milestones: readonly StudioArtifactReviewMilestone[];
  nextFocus: StudioArtifactReviewMilestone | null;
  totalCount: number;
}>;

const reviewMilestonePaths = [
  "reviews/script_review.md",
  "production/storyboard_contact_sheet.md",
  "production/audio/voiceover_review.md",
  "production/render/draft_review.md",
  "production/review_bundle.md",
  "production/channel_handoff.md",
] as const;

/**
 * Builds the read-only artifact review handoff shown in Studio.
 *
 * @param artifacts - Artifact previews loaded for a run.
 * @returns Ordered milestone status for the operator review path.
 */
export function buildArtifactReviewHandoff(
  artifacts: readonly StudioArtifactPreview[],
): StudioArtifactReviewHandoff {
  const artifactsByPath = new Map(artifacts.map((artifact) => [artifact.path, artifact]));
  const milestones = reviewMilestonePaths.map((path) => milestoneForPath(artifactsByPath, path));
  return {
    availableCount: milestones.filter((milestone) => milestone.available).length,
    milestones,
    nextFocus: milestones.find((milestone) => !milestone.available) ?? null,
    totalCount: milestones.length,
  };
}

function milestoneForPath(
  artifactsByPath: ReadonlyMap<string, StudioArtifactPreview>,
  path: (typeof reviewMilestonePaths)[number],
): StudioArtifactReviewMilestone {
  const artifact = artifactsByPath.get(path);
  return {
    action: artifact?.operatorAction ?? "Generate the preceding workflow artifact first.",
    available: artifact?.exists === true,
    label: artifact?.label ?? fallbackLabel(path),
    path,
  };
}

function fallbackLabel(path: string): string {
  switch (path) {
    case "reviews/script_review.md":
      return "Script review";
    case "production/storyboard_contact_sheet.md":
      return "Storyboard contact sheet";
    case "production/audio/voiceover_review.md":
      return "Voiceover review";
    case "production/render/draft_review.md":
      return "Draft render review";
    case "production/review_bundle.md":
      return "Final review handoff";
    case "production/channel_handoff.md":
      return "Manual channel handoff";
    default:
      return path;
  }
}
