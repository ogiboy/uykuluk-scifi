import type { EvidenceMediaStatus, ProductionMediaStatus } from "./statusMediaSummary.js";
import {
  voiceoverRenderApprovalCommand,
  voiceoverRenderApprovalScope,
} from "./voiceoverReviewCommands.js";

/**
 * Builds optional render-approval guidance for current voiceover media evidence.
 *
 * @param runId - The run identifier used by copy-pasteable CLI commands.
 * @param evidenceKey - The media evidence key being summarized.
 * @param evidence - The current media evidence row, when available.
 * @param status - The derived production media status.
 * @returns Optional render approval command and approval scope for voiceover rows.
 */
export function mediaRenderApprovalGuidance(
  runId: string | undefined,
  evidenceKey: ProductionMediaStatus["evidenceKey"],
  evidence: EvidenceMediaStatus | undefined,
  status: ProductionMediaStatus["status"],
): Pick<ProductionMediaStatus, "renderApprovalCommand" | "renderApprovalScope"> {
  if (
    !runId ||
    evidenceKey !== "voiceoverAudio" ||
    status !== "pass" ||
    typeof evidence?.productionVoiceCandidate !== "boolean"
  ) {
    return {};
  }
  return {
    renderApprovalCommand: voiceoverRenderApprovalCommand(runId),
    renderApprovalScope: voiceoverRenderApprovalScope(evidence.productionVoiceCandidate),
  };
}
