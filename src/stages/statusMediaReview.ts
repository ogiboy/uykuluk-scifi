import type { ProductionMediaStatus } from "./statusMediaSummary.js";

export type { ProductionMediaStatus } from "./statusMediaSummary.js";

/**
 * Provides conservative operator review guidance for a production media row.
 *
 * @param artifact - The production media row to describe.
 * @param evidenceIsCurrent - Whether the row came from the current evidence bundle.
 * @returns A review action that keeps CLI/core approval boundaries intact.
 */
export function productionMediaReviewAction(
  artifact: ProductionMediaStatus,
  evidenceIsCurrent: boolean,
): string {
  if (!evidenceIsCurrent || artifact.status === "recorded") {
    return "Regenerate evidence before using this media row as current review proof.";
  }
  if (artifact.status === "block") {
    return "Resolve the blocker from the CLI before approving, rendering, uploading, or publishing.";
  }
  if (artifact.status === "missing") {
    return missingProductionMediaAction(artifact.evidenceKey);
  }
  return passedProductionMediaAction(artifact);
}

function missingProductionMediaAction(evidenceKey: ProductionMediaStatus["evidenceKey"]): string {
  switch (evidenceKey) {
    case "renderPlan":
      return "Generate the render plan and contact sheet from the CLI before voiceover or render work.";
    case "voiceoverAudio":
      return "Generate and review local voiceover from the CLI before render approval.";
    case "draftRender":
      return "Approve and run the local draft render from the CLI only after current plan and voiceover evidence pass.";
  }
}

function passedProductionMediaAction(artifact: ProductionMediaStatus): string {
  if (artifact.evidenceKey === "renderPlan") {
    return renderPlanReviewAction(artifact);
  }
  if (artifact.evidenceKey === "voiceoverAudio") {
    return voiceoverReviewAction(artifact);
  }
  return draftRenderReviewAction(artifact);
}

function renderPlanReviewAction(artifact: ProductionMediaStatus): string {
  const reviewPrefix = artifact.reviewCommand
    ? `Review with ${artifact.reviewCommand}; `
    : "Review the contact sheet locally; ";
  return `${reviewPrefix}confirm scene-to-asset mapping, bookend/source-frame paths, and the contact sheet before voiceover or render approval.`;
}

function voiceoverReviewAction(artifact: ProductionMediaStatus): string {
  const reviewPrefix = artifact.reviewCommand
    ? `Review with ${artifact.reviewCommand}; `
    : "Review the voiceover checklist and WAV locally; ";
  const listeningAction = artifact.localPlaybackPath
    ? `listen to ${artifact.localPlaybackPath}`
    : "listen locally";
  return artifact.detail?.includes("timing/reference only")
    ? `${reviewPrefix}${listeningAction}; use this audio only for local timing review; regenerate reviewed production voice before final render review.`
    : `${reviewPrefix}${listeningAction} and verify pronunciation, pacing, and tone before render approval.`;
}

function draftRenderReviewAction(artifact: ProductionMediaStatus): string {
  const reviewPrefix = artifact.reviewCommand
    ? `Review with ${artifact.reviewCommand}; `
    : "Review the MP4, manifest, and draft checklist locally; ";
  if (artifact.detail?.includes("timing/reference only")) {
    return `${reviewPrefix}treat this MP4 as a timing draft only; production voice is still required before final review.`;
  }
  return `${reviewPrefix}upload and publish remain disabled.`;
}
