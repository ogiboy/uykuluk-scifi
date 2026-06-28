import type { StudioEvidenceSummary } from "./evidenceSummaries";

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
