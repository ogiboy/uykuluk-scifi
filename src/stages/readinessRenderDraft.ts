import { RunRecord } from "../core/state.js";
import { readDraftRenderEvidence } from "./renderEvidence.js";
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
    return {
      name: "draft render available",
      status: "warn",
      message: "Draft render is not generated yet; render remains behind explicit approval.",
    };
  }
  return {
    name: "draft render available",
    status: "block",
    message: evidence.message,
  };
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
