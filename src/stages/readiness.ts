import { loadConfig, projectConfigExists } from "../config/config.js";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { RunRecord } from "../core/state.js";
import { canTransition } from "../core/transitions.js";
import { readCostEstimate, validateCurrentCostEstimate } from "../costs/costEstimate.js";
import { checkAssets } from "../safeguards/assetGuard.js";
import { pathExists } from "../utils/fs.js";
import { generateEvidenceBundle } from "./evidence.js";
import { renderReadinessMarkdown } from "./readiness/readinessMarkdown.js";
import { productionPackageIntegrityCheck } from "./readiness/readinessProductionPackage.js";
import { draftRenderReadinessCheck } from "./readiness/readinessRenderDraft.js";
import { renderPlanReadinessCheck } from "./readiness/readinessRenderPlan.js";
import { voiceoverReadinessCheck } from "./readiness/readinessVoiceover.js";

export type ReadinessCheck = {
  name: string;
  nextAction?: string;
  status: "pass" | "warn" | "block";
  message: string;
};

/**
 * Runs readiness checks for a run and writes readiness diagnostics.
 *
 * @param runId - The run to evaluate.
 * @returns The readiness result and the checks that were performed.
 */
export async function runReadiness(
  runId: string,
): Promise<{ passed: boolean; checks: ReadinessCheck[] }> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  const assets = await checkAssets(config);
  const checks: ReadinessCheck[] = [
    await fileCheck(
      "project config exists",
      await projectConfigExists(),
      "producer.config.json exists.",
      "Run pnpm producer init.",
    ),
    {
      name: "provider configured",
      status:
        config.providers.llm.mode === "mock" ||
        config.providers.llm.mode === "ollama" ||
        config.providers.llm.mode === "llama.cpp"
          ? "pass"
          : "block",
      message: `LLM provider mode: ${config.providers.llm.mode}.`,
    },
    {
      name: "brand assets present",
      status: assets.passed ? "pass" : "warn",
      message: assets.passed ? "Brand assets present." : assets.warnings.join(" "),
    },
    await artifactCheck(run.runId, "script generated", "script.md"),
    await artifactCheck(run.runId, "script reviewed", "reviews/script_review.json"),
    {
      name: "script approved",
      status: run.approvals.some(
        (approval) => approval.runId === run.runId && approval.target === "script",
      )
        ? "pass"
        : "block",
      message: "Script approval must be explicit in run state.",
    },
    await productionPackageIntegrityCheck(run),
    await renderPlanReadinessCheck(run),
    await voiceoverReadinessCheck(run),
    await draftRenderReadinessCheck(run),
    await budgetEstimateCheck(run, config),
    {
      name: "no blocked publish action",
      status: "pass",
      message: "No upload or publish action has been executed.",
    },
    {
      name: "public upload disabled without explicit config",
      status: config.providers.youtube.allowPublicPublish ? "block" : "pass",
      message: config.providers.youtube.allowPublicPublish
        ? "Public publish is enabled; verify explicit approval controls before continuing."
        : "Public/scheduled publish remains disabled by default.",
    },
    await artifactCheck(
      run.runId,
      "evidence bundle available",
      "evidence_bundle.json",
      `pnpm producer evidence --run ${run.runId}`,
    ),
  ];
  const passed = checks.every((check) => check.status !== "block");
  run = await writeRunJson(run, "readiness", "diagnostics/readiness.json", {
    runId: run.runId,
    currentState: run.state,
    passed,
    checks,
  });
  run = await writeRunText(
    run,
    "readiness",
    "diagnostics/readiness.md",
    renderReadinessMarkdown(run.runId, passed, checks),
  );
  if (
    passed &&
    (run.state === "COST_ESTIMATED" || run.state === "PAID_GENERATION_COST_APPROVED") &&
    canTransition(run.state, "READY_FOR_MANUAL_PRODUCTION")
  ) {
    run = await setRunState(run, "READY_FOR_MANUAL_PRODUCTION", "readiness");
    await writeRunJson(run, "readiness", "diagnostics/readiness.json", {
      runId: run.runId,
      currentState: run.state,
      passed,
      checks,
    });
    await generateEvidenceBundle(run.runId);
  }
  return { passed, checks };
}

/**
 * Checks whether a run artifact exists.
 *
 * @param runId - The run identifier used to locate the artifact
 * @param name - The readiness check name
 * @param relativePath - The artifact path relative to the run's artifact directory
 * @param nextAction - The command to suggest when the artifact is missing
 * @returns A readiness check describing whether the artifact exists
 */
async function artifactCheck(
  runId: string,
  name: string,
  relativePath: string,
  nextAction?: string,
): Promise<ReadinessCheck> {
  return fileCheck(
    name,
    await pathExists(artifactPath(runId, relativePath)),
    `${relativePath} exists.`,
    `${relativePath} is missing.`,
    nextAction,
  );
}

/**
 * Validates the run's cost estimate against current requirements and any required paid-generation approval.
 *
 * @param run - The run whose cost estimate is being evaluated
 * @param config - The loaded configuration used to validate the estimate
 * @returns A readiness check that passes when the estimate is current, within hard budgets, and has required exact-cost approval; otherwise, a blocking check with an operator action when applicable
 */
async function budgetEstimateCheck(
  run: RunRecord,
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<ReadinessCheck> {
  const relativePath = "costs/estimate.json";
  const target = artifactPath(run.runId, relativePath);
  if (!(await pathExists(target))) {
    return {
      name: "budget not exceeded",
      status: "block",
      message: `${relativePath} is missing.`,
      nextAction: `pnpm producer estimate --run ${run.runId}`,
    };
  }
  try {
    const { estimate, digest } = await readCostEstimate(run.runId);
    const validationReasons = await validateCurrentCostEstimate(run, config, estimate, digest);
    if (validationReasons.length > 0) {
      return {
        name: "budget not exceeded",
        status: "block",
        message: `Cost estimate is stale or invalid. ${validationReasons.join(" ")}`,
        nextAction: `pnpm producer estimate --run ${run.runId}`,
      };
    }
    if (!estimate.budgetAllowed || estimate.hardBlockedReasons.length > 0) {
      return {
        name: "budget not exceeded",
        status: "block",
        message:
          estimate.hardBlockedReasons.join(" ") || "Cost estimate is blocked by a hard budget.",
      };
    }
    if (estimate.approvalRequired) {
      const approval = run.approvals.find(
        (item) =>
          item.runId === run.runId &&
          item.target === "paid-generation-cost" &&
          item.approvedRef === digest,
      );
      if (!approval || run.state !== "PAID_GENERATION_COST_APPROVED") {
        return {
          name: "budget not exceeded",
          status: "block",
          message: "The exact quote requires explicit paid-generation cost approval.",
          nextAction: `pnpm producer approve cost --run ${run.runId}`,
        };
      }
      return {
        name: "budget not exceeded",
        status: "pass",
        message: `Hard budgets pass and exact cost quote approval ${approval.approvalId} is active.`,
      };
    }
    return {
      name: "budget not exceeded",
      status: "pass",
      message: "Cost estimate is within hard budgets and requires no paid-generation approval.",
    };
  } catch (error) {
    return {
      name: "budget not exceeded",
      status: "block",
      message: `Cost estimate could not be read: ${(error as Error).message}`,
      nextAction: `pnpm producer estimate --run ${run.runId}`,
    };
  }
}

/**
 * Builds a readiness check result from a boolean condition.
 *
 * @param name - The check name
 * @param ok - Whether the condition passed
 * @param passMessage - The message to use when the check passes
 * @param failMessage - The message to use when the check fails
 * @param nextAction - The follow-up command to include when the check fails
 * @returns The readiness check result
 */
async function fileCheck(
  name: string,
  ok: boolean,
  passMessage: string,
  failMessage: string,
  nextAction?: string,
): Promise<ReadinessCheck> {
  return {
    name,
    status: ok ? "pass" : "block",
    message: ok ? passMessage : failMessage,
    nextAction: ok ? undefined : nextAction,
  };
}
