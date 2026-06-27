import type { StudioEvidenceSummary } from "./evidenceSummaries";

type EvidenceStatus = StudioEvidenceSummary["status"];

export function blockedActionsIntro(evidenceStatus: EvidenceStatus): string {
  if (evidenceStatus === "available") {
    return "Read-only evidence from the current CLI/core safeguard bundle. These are not approvals and do not unblock upload, render, or publish.";
  }
  return "Blocked-action evidence is unavailable until the evidence bundle is current. Studio does not infer that actions are unblocked from missing, stale, or invalid evidence.";
}

export function blockedActionsEmptyMessage(evidenceStatus: EvidenceStatus): string {
  if (evidenceStatus === "available") {
    return "No blocked actions recorded in the latest evidence bundle.";
  }
  return "Regenerate evidence before treating blocked-action status as review proof.";
}

export function productionMediaIntro(evidenceStatus: EvidenceStatus): string {
  if (evidenceStatus === "available") {
    return "Read-only summary from the current CLI evidence bundle. Missing or blocked media remains a CLI workflow issue; Studio does not approve, render, upload, or publish.";
  }
  return "Read-only fallback from persisted artifact records because the evidence bundle is not current. Regenerate evidence before treating media status as review proof.";
}

export function shouldShowEvidenceRemediation(evidenceStatus: EvidenceStatus): boolean {
  return evidenceStatus !== "available";
}
