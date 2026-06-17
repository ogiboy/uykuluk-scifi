import { loadConfig } from "../config/config";
import { writeRunJson, writeRunText } from "../core/artifacts";
import { appendLedgerEvent } from "../core/ledger";
import { loadRun, setRunState } from "../core/runStore";
import { assertTransition } from "../core/transitions";
import { defaultStagePricing } from "../costs/pricing";
import { checkBudget } from "../safeguards/budgetGuard";
import { requireState } from "../safeguards/approvalGuard";
import { table } from "../utils/markdown";

export async function estimateCost(runId: string): Promise<unknown> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "estimate");
  assertTransition(run.state, "COST_ESTIMATED");
  try {
    const stages = Object.values(defaultStagePricing).map((pricing) => ({
      ...pricing,
      enabled:
        pricing.stage === "tts"
          ? config.providers.tts.enabled
          : pricing.stage === "imageGeneration" || pricing.stage === "videoGeneration"
            ? config.providers.imageGeneration.enabled
            : pricing.stage === "upload"
              ? config.providers.youtube.enabled
              : true,
    }));
    const nextEstimatedUsd = stages.reduce(
      (sum, stage) => sum + (stage.enabled ? stage.estimatedUsd : 0),
      0,
    );
    const budget = await checkBudget({
      run,
      config,
      stage: "estimate",
      provider: "local-estimator",
      estimatedUsd: nextEstimatedUsd,
    });
    const estimate = {
      runId: run.runId,
      stages,
      estimatedStageCost: nextEstimatedUsd,
      cumulativeEstimatedRunCost: budget.cumulativeEstimatedRunCostUsd,
      budgets: config.budgets,
      nextStepAllowed: budget.allowed && !budget.approvalRequired,
      blockedReasons: [
        ...budget.blockedReasons,
        ...(budget.approvalRequired ? ["Explicit approval required above threshold."] : []),
      ],
    };
    await appendLedgerEvent({
      runId: run.runId,
      type: "COST_ESTIMATED",
      stage: "estimate",
      message: "Cost estimate generated.",
      data: estimate,
    });
    run = await writeRunJson(run, "estimate", "costs/estimate.json", estimate);
    run = await writeRunText(
      run,
      "estimate",
      "costs/estimate.md",
      [
        "# Cost Estimate",
        "",
        table(
          ["Stage", "Provider", "Enabled", "Estimated USD"],
          stages.map((stage) => [
            stage.stage,
            stage.provider,
            String(stage.enabled),
            stage.estimatedUsd.toFixed(4),
          ]),
        ),
        "",
        `Cumulative estimated run cost: ${budget.cumulativeEstimatedRunCostUsd.toFixed(4)} USD`,
        `Per-video budget: ${config.budgets.perVideoUsd.toFixed(4)} USD`,
        `Daily budget: ${config.budgets.dailyUsd.toFixed(4)} USD`,
        `Weekly budget: ${config.budgets.weeklyUsd.toFixed(4)} USD`,
        `Next step allowed: ${estimate.nextStepAllowed}`,
        "",
        "## Blocks",
        "",
        estimate.blockedReasons.length
          ? estimate.blockedReasons.map((item) => `- ${item}`).join("\n")
          : "- None",
      ].join("\n"),
    );
    await setRunState(run, "COST_ESTIMATED", "estimate");
    return estimate;
  } catch (error) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "ERROR",
      stage: "estimate",
      message: (error as Error).message,
    });
    throw error;
  }
}
