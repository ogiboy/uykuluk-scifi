import { RunRecord } from "../core/state.js";
import { readDraftRenderEvidence } from "./renderEvidence.js";
import type { ReadinessCheck } from "./readiness.js";

export async function draftRenderReadinessCheck(run: RunRecord): Promise<ReadinessCheck> {
  const evidence = await readDraftRenderEvidence(run);
  if (evidence.status === "pass") {
    return {
      name: "draft render available",
      status: "pass",
      message: `${evidence.path} exists with ${Math.round(evidence.durationSeconds)}s draft video.`,
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
