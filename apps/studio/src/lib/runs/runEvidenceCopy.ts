import {
  productionMediaReviewAction as coreProductionMediaReviewAction,
  type ProductionMediaStatus,
} from "../../../../../src/stages/status/statusMediaReview";
import type { StudioEvidenceSummary } from "./evidenceSummaries";

export type { ProductionMediaStatus } from "../../../../../src/stages/status/statusMediaReview";

type EvidenceStatus = StudioEvidenceSummary["status"];

export type ProductionMediaReviewSummary = Readonly<{
  blockedCount: number;
  focus: ProductionMediaReviewFocus | null;
  missingCount: number;
  recordedOnlyCount: number;
  title: string;
  tone: "attention" | "blocked" | "pending" | "ready";
  totalCount: number;
  verifiedCount: number;
}>;

export type ProductionMediaReviewFocus = Readonly<{
  action: string;
  label: string;
  status: ProductionMediaStatus["status"];
}>;

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
  return coreProductionMediaReviewAction(artifact, evidenceStatus === "available");
}

/**
 * Summarizes local production media status for the Studio review surface.
 *
 * @param evidenceStatus - Whether the evidence bundle is current.
 * @param productionMedia - The media rows projected from evidence and run artifacts.
 * @returns Count and next-focus copy for operator review.
 */
export function productionMediaReviewSummary(
  evidenceStatus: EvidenceStatus,
  productionMedia: readonly ProductionMediaStatus[],
): ProductionMediaReviewSummary {
  const blockedCount = countMediaByStatus(productionMedia, "block");
  const missingCount = countMediaByStatus(productionMedia, "missing");
  const recordedOnlyCount = countMediaByStatus(productionMedia, "recorded");
  const verifiedCount =
    evidenceStatus === "available" ? countMediaByStatus(productionMedia, "pass") : 0;
  const tone = productionMediaReviewTone({
    blockedCount,
    evidenceStatus,
    missingCount,
    recordedOnlyCount,
    totalCount: productionMedia.length,
    verifiedCount,
  });
  return {
    blockedCount,
    focus: productionMediaReviewFocus(evidenceStatus, productionMedia),
    missingCount,
    recordedOnlyCount,
    title: productionMediaReviewTitle(tone),
    tone,
    totalCount: productionMedia.length,
    verifiedCount,
  };
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

function countMediaByStatus(
  productionMedia: readonly ProductionMediaStatus[],
  status: ProductionMediaStatus["status"],
): number {
  return productionMedia.filter((artifact) => artifact.status === status).length;
}

function productionMediaReviewTone(input: {
  blockedCount: number;
  evidenceStatus: EvidenceStatus;
  missingCount: number;
  recordedOnlyCount: number;
  totalCount: number;
  verifiedCount: number;
}): ProductionMediaReviewSummary["tone"] {
  if (input.blockedCount > 0) {
    return "blocked";
  }
  if (input.evidenceStatus !== "available" || input.recordedOnlyCount > 0) {
    return "attention";
  }
  if (input.totalCount > 0 && input.verifiedCount === input.totalCount) {
    return "ready";
  }
  if (input.missingCount > 0) {
    return "pending";
  }
  return "attention";
}

function productionMediaReviewTitle(tone: ProductionMediaReviewSummary["tone"]): string {
  switch (tone) {
    case "blocked":
      return "Media review blocked";
    case "attention":
      return "Refresh evidence before trusting media";
    case "ready":
      return "Local media ready for review";
    case "pending":
      return "Media artifacts still pending";
  }
}

function productionMediaReviewFocus(
  evidenceStatus: EvidenceStatus,
  productionMedia: readonly ProductionMediaStatus[],
): ProductionMediaReviewFocus | null {
  const artifact =
    productionMedia.find((item) => item.status === "block") ??
    productionMedia.find((item) => item.status === "recorded") ??
    productionMedia.find((item) => item.status === "missing") ??
    preferredReviewArtifact(productionMedia);
  if (!artifact) {
    return null;
  }
  return {
    action: productionMediaReviewAction(evidenceStatus, artifact),
    label: artifact.label,
    status: artifact.status,
  };
}

function preferredReviewArtifact(
  productionMedia: readonly ProductionMediaStatus[],
): ProductionMediaStatus | undefined {
  return (
    productionMedia.find((artifact) => artifact.evidenceKey === "draftRender") ??
    productionMedia.find((artifact) => artifact.evidenceKey === "voiceoverAudio") ??
    productionMedia.find((artifact) => artifact.evidenceKey === "renderPlan") ??
    productionMedia[0]
  );
}
