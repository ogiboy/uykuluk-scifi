import { SafeExitError } from "../core/errors.js";
import { loadRun } from "../core/runStore.js";
import {
  renderDecisionJsonPath,
  renderDecisionMarkdownPath,
} from "./render/renderDecisionCommands.js";
import type { RenderDecisionRecord } from "./render/renderDecisionContracts.js";
import { readRenderDecisionStatus } from "./render/renderDecisionStatus.js";

export type RenderDecisionReviewHandoff = {
  blockedActions: string[];
  createdAt: string;
  decision: RenderDecisionRecord["decision"];
  draftRender: RenderDecisionRecord["draftRender"];
  nextSafeAction: string;
  notes: string;
  renderApproval: RenderDecisionRecord["renderApproval"];
  renderDecisionMarkdownPath: string;
  renderDecisionPath: string;
  reviewedBy: string;
  runId: string;
  voiceover: RenderDecisionRecord["voiceover"];
};

/**
 * Reads the validated local render-decision handoff for operator review.
 *
 * @param runId - The run whose recorded render decision should be reviewed.
 * @returns The operator-facing render-decision review handoff.
 */
export async function reviewRenderDecision(runId: string): Promise<RenderDecisionReviewHandoff> {
  const run = await loadRun(runId);
  const status = await readRenderDecisionStatus(run);
  if (status.kind === "present") {
    return {
      blockedActions: status.decision.blockedActions,
      createdAt: status.decision.createdAt,
      decision: status.decision.decision,
      draftRender: status.decision.draftRender,
      nextSafeAction: status.decision.nextSafeAction,
      notes: status.decision.notes,
      renderApproval: status.decision.renderApproval,
      renderDecisionMarkdownPath,
      renderDecisionPath: renderDecisionJsonPath,
      reviewedBy: status.decision.reviewedBy,
      runId: status.decision.runId,
      voiceover: status.decision.voiceover,
    };
  }
  throw new SafeExitError(renderDecisionReviewBlockedMessage(status));
}

/**
 * Formats the render-decision review handoff for console output.
 *
 * @param handoff - The review handoff to format.
 * @returns Operator-readable console text.
 */
export function formatRenderDecisionReviewConsole(handoff: RenderDecisionReviewHandoff): string {
  return [
    `Run: ${handoff.runId}`,
    `Decision: ${handoff.decision}`,
    `Reviewed by: ${handoff.reviewedBy}`,
    `Created at: ${handoff.createdAt}`,
    `Decision artifact: ${handoff.renderDecisionPath}`,
    `Decision review document: ${handoff.renderDecisionMarkdownPath}`,
    `Draft render: ${handoff.draftRender.path}`,
    `Draft SHA-256: ${handoff.draftRender.sha256}`,
    `FFmpeg review command: ${handoff.draftRender.reviewCommand}`,
    `Render approval: ${handoff.renderApproval.approvalId}`,
    `Render approval ref: ${handoff.renderApproval.approvedRef}`,
    `Voiceover: ${handoff.voiceover.mode}, ${handoff.voiceover.quality}, production candidate=${String(
      handoff.voiceover.productionVoiceCandidate,
    )}`,
    `Next safe action: ${handoff.nextSafeAction}`,
    "Notes:",
    handoff.notes,
    "Still blocked:",
    ...handoff.blockedActions.map((action) => `- ${action}`),
  ].join("\n");
}

function renderDecisionReviewBlockedMessage(
  status: Awaited<ReturnType<typeof readRenderDecisionStatus>>,
): string {
  if (status.kind === "missing") {
    return status.nextAction
      ? `Render decision review requires a recorded operator decision. Run ${status.nextAction}`
      : "Render decision review requires a recorded operator decision after a local draft render.";
  }
  return `Render decision review is blocked: ${status.message}. Next safe action: ${status.nextAction}`;
}
