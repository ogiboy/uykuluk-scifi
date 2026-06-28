import { RunRecord } from "../core/state.js";
import { readDraftRenderEvidence } from "./renderEvidence.js";
import { readVoiceoverAudioEvidence } from "./voiceoverEvidence.js";
import type { ReadinessCheck } from "./readiness.js";

/**
 * Checks whether a draft render is available and reports the current readiness status.
 *
 * When draft render evidence passes, returns a passing check with details about the available render.
 * When draft render evidence is missing, returns a warning and may include the next CLI action based on voiceover status.
 * For any other draft render evidence status, returns a blocking check with the evidence message.
 *
 * @param run - The run record to evaluate
 * @returns A readiness check for draft render availability
 */
export async function draftRenderReadinessCheck(run: RunRecord): Promise<ReadinessCheck> {
  const evidence = await readDraftRenderEvidence(run);
  if (evidence.status === "pass") {
    return {
      name: "draft render available",
      status: "pass",
      message: draftRenderReadyMessage(evidence),
    };
  }
  if (evidence.status === "missing") {
    const voiceover = await readVoiceoverAudioEvidence(run);
    return {
      name: "draft render available",
      status: "warn",
      message:
        voiceover.status === "pass"
          ? "Draft render is not generated yet; render remains behind explicit approval."
          : "Draft render is not generated yet; generate voiceover audio before render approval.",
      nextAction: draftRenderNextAction(run, voiceover),
    };
  }
  return {
    name: "draft render available",
    status: "block",
    message: evidence.message,
  };
}

/**
 * Builds the next render command for a run.
 *
 * @param run - The run record used to determine the command target and current state
 * @param voiceoverStatus - The voiceover audio status
 * @returns A render command when voiceover audio is ready, or `undefined` otherwise
 */
function draftRenderNextAction(
  run: RunRecord,
  voiceover: Awaited<ReturnType<typeof readVoiceoverAudioEvidence>>,
): string | undefined {
  if (voiceover.status !== "pass") {
    return undefined;
  }
  if (run.state === "RENDER_APPROVED") {
    return `pnpm producer render --run ${run.runId}`;
  }
  if (!voiceover.productionVoiceCandidate) {
    return `Review deterministic reference audio; approve render only for a local timing draft with pnpm producer approve render --run ${run.runId}`;
  }
  return `pnpm producer approve render --run ${run.runId}`;
}

/**
 * Formats the readiness message for an available draft render.
 *
 * @param evidence - Successful draft render evidence.
 * @returns The draft render availability message, including duration and available video details.
 */
function draftRenderReadyMessage(
  evidence: Extract<Awaited<ReturnType<typeof readDraftRenderEvidence>>, { status: "pass" }>,
): string {
  const duration = Math.round(evidence.durationSeconds);
  if (!evidence.mediaProbe) {
    return `${evidence.path} exists with ${duration}s draft video${sourceFrameDetail(evidence)}${voiceoverDetail(evidence)}.`;
  }
  return `${evidence.path} exists with ${duration}s ffprobe-validated draft video (${evidence.mediaProbe.video.width}x${evidence.mediaProbe.video.height}, audio stream present${sourceFrameDetail(evidence)}${voiceoverDetail(evidence)}).`;
}

/**
 * Describes the source frame segments included in a draft render.
 *
 * @param evidence - Draft render evidence with a passing status
 * @returns An empty string when no source frames are present; otherwise, a comma-prefixed source frame segment list
 */
function sourceFrameDetail(
  evidence: Extract<Awaited<ReturnType<typeof readDraftRenderEvidence>>, { status: "pass" }>,
): string {
  if (evidence.sourceFrameCount === 0) {
    return "";
  }
  return `, source frames ${evidence.sourceFrameSegments.join("/")}`;
}

/**
 * Describes the voiceover details included in draft render evidence.
 *
 * @param evidence - Draft render evidence with a passing status
 * @returns A voiceover detail suffix for the readiness message
 */
function voiceoverDetail(
  evidence: Extract<Awaited<ReturnType<typeof readDraftRenderEvidence>>, { status: "pass" }>,
): string {
  if (evidence.voiceoverProductionVoiceCandidate) {
    return `, voiceover ${evidence.voiceoverMode} production voice candidate`;
  }
  return `, voiceover ${evidence.voiceoverMode} timing/reference only`;
}
