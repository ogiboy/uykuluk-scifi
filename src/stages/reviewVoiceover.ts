import { SafeExitError } from "../core/errors.js";
import { loadRun } from "../core/runStore.js";
import { readVoiceoverAudioEvidence } from "./voiceoverEvidence.js";
import {
  voiceoverRenderApprovalCommand,
  voiceoverRenderApprovalScope,
  type VoiceoverRenderApprovalScope,
} from "./voiceoverReviewCommands.js";

type PassingVoiceoverEvidence = Extract<
  Awaited<ReturnType<typeof readVoiceoverAudioEvidence>>,
  { status: "pass" }
>;

export type VoiceoverReviewHandoff = {
  audioPath: string;
  blockedActions: string[];
  durationSeconds: number;
  mode: PassingVoiceoverEvidence["mode"];
  nextSafeAction: string;
  productionVoiceCandidate: boolean;
  quality: PassingVoiceoverEvidence["quality"];
  renderApprovalCommand: string;
  renderApprovalScope: VoiceoverRenderApprovalScope;
  reviewPath: string;
  runId: string;
  sourceWordCount: number;
};

/**
 * Reads the local voiceover review handoff for a run.
 *
 * @param runId - The run whose voiceover should be reviewed.
 * @returns The operator-facing voiceover review handoff.
 */
export async function reviewVoiceover(runId: string): Promise<VoiceoverReviewHandoff> {
  const run = await loadRun(runId);
  const evidence = await readVoiceoverAudioEvidence(run);
  if (evidence.status === "missing") {
    throw new SafeExitError(
      `Voiceover review requires generated audio. Run pnpm producer voice --run ${run.runId}`,
    );
  }
  if (evidence.status === "block") {
    throw new SafeExitError(
      `Voiceover review requires valid voiceover evidence: ${evidence.message}`,
    );
  }
  const renderApprovalCommand = voiceoverRenderApprovalCommand(run.runId);
  const renderApprovalScope = voiceoverRenderApprovalScope(evidence.productionVoiceCandidate);
  return {
    audioPath: evidence.path,
    blockedActions: voiceoverReviewBlockedActions(evidence),
    durationSeconds: evidence.durationSeconds,
    mode: evidence.mode,
    nextSafeAction: voiceoverReviewNextAction(evidence, renderApprovalCommand),
    productionVoiceCandidate: evidence.productionVoiceCandidate,
    quality: evidence.quality,
    renderApprovalCommand,
    renderApprovalScope,
    reviewPath: evidence.reviewPath,
    runId: run.runId,
    sourceWordCount: evidence.sourceWordCount,
  };
}

/**
 * Formats the voiceover review handoff for console output.
 *
 * @param handoff - The review handoff to format.
 * @returns Operator-readable console text.
 */
export function formatVoiceoverReviewConsole(handoff: VoiceoverReviewHandoff): string {
  return [
    `Run: ${handoff.runId}`,
    `Voiceover: ${handoff.audioPath}`,
    `Review artifact: ${handoff.reviewPath}`,
    `Mode: ${handoff.mode}`,
    `Quality: ${handoff.quality}`,
    `Duration: ${Math.round(handoff.durationSeconds)}s`,
    `Source words: ${handoff.sourceWordCount}`,
    `Production voice candidate: ${String(handoff.productionVoiceCandidate)}`,
    `Render approval scope: ${handoff.renderApprovalScope}`,
    `Render approval command: ${handoff.renderApprovalCommand}`,
    `Next safe action: ${handoff.nextSafeAction}`,
    "Still blocked:",
    ...handoff.blockedActions.map((action) => `- ${action}`),
  ].join("\n");
}

function voiceoverReviewNextAction(
  evidence: PassingVoiceoverEvidence,
  renderApprovalCommand: string,
): string {
  if (evidence.productionVoiceCandidate) {
    return `Listen to ${evidence.reviewPath}; if voice quality passes, run ${renderApprovalCommand}`;
  }
  return `Listen to ${evidence.reviewPath}; approve render only for a local timing draft with ${renderApprovalCommand}`;
}

function voiceoverReviewBlockedActions(evidence: PassingVoiceoverEvidence): string[] {
  const actions = [
    "Render execution still requires explicit render approval for the current render plan and voiceover audio.",
    "Private upload, scheduled publish, and public publish remain disabled.",
  ];
  if (!evidence.productionVoiceCandidate) {
    actions.unshift(
      "Final production voice remains blocked until reviewed local Piper audio exists.",
    );
  }
  return actions;
}
