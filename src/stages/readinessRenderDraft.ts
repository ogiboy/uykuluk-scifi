import { RunRecord } from "../core/state.js";
import { readDraftRenderEvidence } from "./renderEvidence.js";
import { readVoiceoverAudioEvidence } from "./voiceoverEvidence.js";
import type { ReadinessCheck } from "./readiness.js";

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
      nextAction: draftRenderNextAction(run, voiceover.status),
    };
  }
  return {
    name: "draft render available",
    status: "block",
    message: evidence.message,
  };
}

function draftRenderNextAction(
  run: RunRecord,
  voiceoverStatus: Awaited<ReturnType<typeof readVoiceoverAudioEvidence>>["status"],
): string | undefined {
  if (voiceoverStatus !== "pass") {
    return undefined;
  }
  if (run.state === "RENDER_APPROVED") {
    return `pnpm producer render --run ${run.runId}`;
  }
  return `pnpm producer approve render --run ${run.runId}`;
}

function draftRenderReadyMessage(
  evidence: Extract<Awaited<ReturnType<typeof readDraftRenderEvidence>>, { status: "pass" }>,
): string {
  const duration = Math.round(evidence.durationSeconds);
  if (!evidence.mediaProbe) {
    return `${evidence.path} exists with ${duration}s draft video${sourceFrameDetail(evidence)}.`;
  }
  return `${evidence.path} exists with ${duration}s ffprobe-validated draft video (${evidence.mediaProbe.video.width}x${evidence.mediaProbe.video.height}, audio stream present${sourceFrameDetail(evidence)}).`;
}

function sourceFrameDetail(
  evidence: Extract<Awaited<ReturnType<typeof readDraftRenderEvidence>>, { status: "pass" }>,
): string {
  if (evidence.sourceFrameCount === 0) {
    return "";
  }
  return `, source frames ${evidence.sourceFrameSegments.join("/")}`;
}
