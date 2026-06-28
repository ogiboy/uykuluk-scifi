import { RunRecord } from "../core/state.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import type { ReadinessCheck } from "./readiness.js";

/**
 * Checks whether a render plan exists and is ready to use.
 *
 * @param run - The run to check.
 * @returns A readiness result for render plan availability.
 */
export async function renderPlanReadinessCheck(run: RunRecord): Promise<ReadinessCheck> {
  const evidence = await readRenderPlanEvidence(run);
  if (evidence.status === "pass") {
    return {
      name: "render plan available",
      status: "pass",
      message: `${evidence.path} exists with ${evidence.assetCount} tracked assets.`,
    };
  }
  if (evidence.status === "missing") {
    return {
      name: "render plan available",
      status: "warn",
      message: "Render plan is not generated yet; generate it before TTS or FFmpeg render work.",
      nextAction: `pnpm producer render-plan --run ${run.runId}`,
    };
  }
  return {
    name: "render plan available",
    status: "block",
    message: evidence.message,
    nextAction: `pnpm producer render-plan --run ${run.runId}`,
  };
}
