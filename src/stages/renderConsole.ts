import {
  draftRenderManifestPath,
  draftRenderReviewPath,
  type DraftRenderManifest,
} from "./renderEvidence.js";

/**
 * Formats the operator-facing console handoff after a local draft render completes.
 *
 * @param manifest - The draft render manifest written by `producer render`.
 * @returns A concise local-only review handoff for CLI operators.
 */
export function formatRenderDraftConsole(manifest: DraftRenderManifest): string {
  return [
    `Draft render available: ${manifest.output.path}`,
    `Review document: ${draftRenderReviewPath}`,
    `Manifest: ${draftRenderManifestPath}`,
    `FFmpeg review command: ${manifest.ffmpeg.reviewCommand}`,
    "Next safe action: review the MP4 locally with the manifest and draft checklist; upload and publish remain disabled.",
  ].join("\n");
}
