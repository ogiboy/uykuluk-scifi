import type { StudioEvidenceSummary } from "./evidenceSummaries";
import type { ProductionMediaStatus } from "../../../../src/stages/statusMediaSummary";

type EvidenceStatus = StudioEvidenceSummary["status"];

/**
 * Describes blocked-action evidence status in the Studio UI.
 *
 * @param evidenceStatus - The current evidence bundle status
 * @returns A read-only summary when the evidence bundle is current; otherwise, a message stating that blocked-action evidence is unavailable until the bundle is current
 */
export function blockedActionsIntro(evidenceStatus: EvidenceStatus): string {
  if (evidenceStatus === "available") {
    return "Read-only evidence from the current CLI/core safeguard bundle. These are not approvals and do not unblock upload, render, or publish.";
  }
  return "Blocked-action evidence is unavailable until the evidence bundle is current. Studio does not infer that actions are unblocked from missing, stale, or invalid evidence.";
}

/**
 * Describes the blocked-action evidence state when no actions were recorded.
 *
 * @param evidenceStatus - The current evidence bundle status.
 * @returns A message stating that no blocked actions were recorded when the bundle is current, or that evidence should be regenerated before using blocked-action status as review proof otherwise.
 */
export function blockedActionsEmptyMessage(evidenceStatus: EvidenceStatus): string {
  if (evidenceStatus === "available") {
    return "No blocked actions recorded in the latest evidence bundle.";
  }
  return "Regenerate evidence before treating blocked-action status as review proof.";
}

/**
 * Describes the production media status summary for the current evidence state.
 *
 * @param evidenceStatus - The current evidence bundle status.
 * @returns A read-only summary message for available evidence, or a fallback message when the evidence bundle is not current.
 */
export function productionMediaIntro(evidenceStatus: EvidenceStatus): string {
  if (evidenceStatus === "available") {
    return "Read-only summary from the current CLI evidence bundle. Missing or blocked media remains a CLI workflow issue; Studio does not approve, render, upload, or publish.";
  }
  return "Read-only fallback from persisted artifact records because the evidence bundle is not current. Regenerate evidence before treating media status as review proof.";
}

/**
 * Provides operator-facing review guidance for a production-media row.
 *
 * @param evidenceStatus - The current evidence bundle status.
 * @param artifact - The production media row being displayed.
 * @returns A short review action that preserves the CLI/core approval boundary.
 */
export function productionMediaReviewAction(
  evidenceStatus: EvidenceStatus,
  artifact: ProductionMediaStatus,
): string {
  if (evidenceStatus !== "available" || artifact.status === "recorded") {
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

/**
 * Describes how artifact previews should be interpreted for the current evidence state.
 *
 * @param evidenceStatus - The current evidence bundle status.
 * @returns Copy that distinguishes file availability from current workflow evidence.
 */
export function artifactPreviewsIntro(evidenceStatus: EvidenceStatus): string {
  if (evidenceStatus === "available") {
    return "File availability is shown alongside the current evidence bundle. Artifact previews are read-only and do not grant approvals.";
  }
  return "File availability is shown from local artifact records only. Regenerate evidence before treating any previewed artifact as current review proof.";
}

/**
 * Determines whether evidence remediation messaging should be shown.
 *
 * @param evidenceStatus - The current evidence bundle status.
 * @returns `true` if the evidence bundle is not current, `false` otherwise.
 */
export function shouldShowEvidenceRemediation(evidenceStatus: EvidenceStatus): boolean {
  return evidenceStatus !== "available";
}

/**
 * Chooses the review action for missing production media.
 *
 * @param evidenceKey - The evidence key for the missing artifact.
 * @returns The operator action to take from the CLI.
 */
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

/**
 * Chooses the review action for media that passes current evidence.
 *
 * @param artifact - The production media row being displayed.
 * @returns The next review action for the operator.
 */
function passedProductionMediaAction(artifact: ProductionMediaStatus): string {
  if (artifact.evidenceKey === "renderPlan") {
    return "Review scene-to-asset mapping and the contact sheet before voiceover or render approval.";
  }
  if (artifact.evidenceKey === "voiceoverAudio") {
    return voiceoverReviewAction(artifact.detail);
  }
  return draftRenderReviewAction(artifact.detail);
}

/**
 * Chooses voiceover review copy from the evidence detail.
 *
 * @param detail - Optional detail text produced from the current evidence bundle.
 * @returns The operator review action for voiceover audio.
 */
function voiceoverReviewAction(detail: string | undefined): string {
  return detail?.includes("timing/reference only")
    ? "Use this audio only for local timing review; regenerate reviewed production voice before final render review."
    : "Listen locally and verify pronunciation, pacing, and tone before render approval.";
}

/**
 * Chooses draft-render review copy from the evidence detail.
 *
 * @param detail - Optional detail text produced from the current evidence bundle.
 * @returns The operator review action for a local draft render.
 */
function draftRenderReviewAction(detail: string | undefined): string {
  return detail?.includes("timing/reference only")
    ? "Review this MP4 as a timing draft only; production voice is still required before final review."
    : "Review the MP4, manifest, and draft checklist locally; upload and publish remain disabled.";
}
