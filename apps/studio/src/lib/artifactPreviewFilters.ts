import type { StudioArtifactPreview } from "./artifactPreviews";

export const artifactPreviewStatusFilters = ["all", "available", "missing"] as const;

export type ArtifactPreviewStatusFilter = (typeof artifactPreviewStatusFilters)[number];

export type ArtifactPreviewFilterInput = Readonly<{
  query: string;
  status: ArtifactPreviewStatusFilter;
}>;

export type ArtifactPreviewStatusCounts = Readonly<Record<ArtifactPreviewStatusFilter, number>>;

export type ArtifactPreviewEmptyState = Readonly<{ heading: string; message: string }>;

/**
 * Filters Studio artifact previews without mutating the persisted artifact projection.
 *
 * @param artifacts - The artifact previews to filter.
 * @param input - Operator search and availability controls.
 * @returns Matching artifact previews in their existing order.
 */
export function filterArtifactPreviews(
  artifacts: readonly StudioArtifactPreview[],
  input: ArtifactPreviewFilterInput,
): StudioArtifactPreview[] {
  const query = input.query.trim().toLowerCase();
  return artifacts.filter(
    (artifact) =>
      artifactMatchesStatus(artifact, input.status) && artifactMatchesQuery(artifact, query),
  );
}

/**
 * Counts artifact previews by availability status.
 *
 * @param artifacts - The artifact previews to count.
 * @returns Counts for all, available, and missing previews.
 */
export function countArtifactPreviewStatuses(
  artifacts: readonly StudioArtifactPreview[],
): ArtifactPreviewStatusCounts {
  return {
    all: artifacts.length,
    available: artifacts.filter((artifact) => artifact.exists).length,
    missing: artifacts.filter((artifact) => !artifact.exists).length,
  };
}

/**
 * Builds operator-facing empty-state copy for artifact preview projections.
 *
 * @param totalArtifacts - Total artifact preview definitions before filtering.
 * @param visibleArtifacts - Artifact previews visible after search and status filtering.
 * @returns Empty-state copy that distinguishes no configured previews from filtered-away previews.
 */
export function artifactPreviewEmptyState(
  totalArtifacts: number,
  visibleArtifacts: number,
): ArtifactPreviewEmptyState {
  if (totalArtifacts === 0) {
    return {
      heading: "No artifact previews configured",
      message: "The Studio artifact preview catalog is empty for this run surface.",
    };
  }
  if (visibleArtifacts === 0) {
    return {
      heading: "No matching artifacts",
      message: "Clear the artifact search text or choose a broader availability filter.",
    };
  }
  return {
    heading: "No artifacts shown",
    message: "Reset artifact preview filters to return to the full review catalog.",
  };
}

function artifactMatchesStatus(
  artifact: StudioArtifactPreview,
  status: ArtifactPreviewStatusFilter,
): boolean {
  switch (status) {
    case "all":
      return true;
    case "available":
      return artifact.exists;
    case "missing":
      return !artifact.exists;
  }
}

function artifactMatchesQuery(artifact: StudioArtifactPreview, query: string): boolean {
  if (!query) {
    return true;
  }
  return [
    artifact.description,
    artifact.group,
    artifact.kind,
    artifact.label,
    artifact.operatorAction,
    artifact.path,
  ].some((value) => value.toLowerCase().includes(query));
}
