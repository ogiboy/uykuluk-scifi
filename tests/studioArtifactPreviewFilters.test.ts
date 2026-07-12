import { describe, expect, it } from "vitest";
import {
  artifactPreviewEmptyState,
  countArtifactPreviewStatuses,
  filterArtifactPreviews,
} from "../apps/studio/src/lib/artifacts/artifactPreviewFilters";
import { studioArtifactPreview } from "./studioArtifactPreviewFixtures";

describe("Studio artifact preview filters", () => {
  const artifacts = [
    studioArtifactPreview({
      description: "Operator contact sheet with visual rhythm.",
      exists: true,
      group: "Render Planning",
      kind: "markdown",
      label: "Storyboard contact sheet",
      path: "production/storyboard_contact_sheet.md",
    }),
    studioArtifactPreview({
      description: "Local TTS WAV generated after readiness.",
      exists: false,
      group: "Audio And Render",
      kind: "binary",
      label: "Voiceover audio",
      path: "production/audio/voiceover.wav",
    }),
    studioArtifactPreview({
      description: "Current evidence, blocked actions, and next safe command.",
      exists: true,
      group: "Evidence And Readiness",
      kind: "json",
      label: "Evidence bundle",
      path: "evidence_bundle.json",
    }),
  ];

  it("counts artifact preview availability without relying on current filters", () => {
    expect(countArtifactPreviewStatuses(artifacts)).toEqual({ all: 3, available: 2, missing: 1 });
  });

  it("filters artifact previews by search text and availability", () => {
    expect(
      filterArtifactPreviews(artifacts, { query: "voiceover", status: "all" }).map(
        (artifact) => artifact.path,
      ),
    ).toEqual(["production/audio/voiceover.wav"]);
    expect(
      filterArtifactPreviews(artifacts, { query: "operator", status: "available" }).map(
        (artifact) => artifact.path,
      ),
    ).toEqual(["production/storyboard_contact_sheet.md"]);
    expect(
      filterArtifactPreviews(artifacts, { query: "", status: "missing" }).map(
        (artifact) => artifact.path,
      ),
    ).toEqual(["production/audio/voiceover.wav"]);
  });

  it("distinguishes an empty preview catalog from filtered-away artifact previews", () => {
    expect(artifactPreviewEmptyState(0, 0)).toEqual({
      heading: "No artifact previews configured",
      message: "The Studio artifact preview catalog is empty for this run surface.",
    });
    expect(artifactPreviewEmptyState(3, 0)).toEqual({
      heading: "No matching artifacts",
      message: "Clear the artifact search text or choose a broader availability filter.",
    });
  });
});
