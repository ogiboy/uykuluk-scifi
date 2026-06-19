import { loadConfig } from "../config/config";
import { buildCostEstimate } from "../costs/costEstimate";
import { renderCostEstimateMarkdown } from "../costs/costEstimatePresentation";
import { writeRunJson, writeRunText } from "../core/artifacts";
import { appendLedgerEvent } from "../core/ledger";
import { loadRun, setRunState } from "../core/runStore";
import { assertTransition } from "../core/transitions";
import { requireState } from "../safeguards/approvalGuard";

export async function estimateCost(runId: string): Promise<unknown> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "estimate");
  assertTransition(run.state, "COST_ESTIMATED");
  try {
    const estimate = await buildCostEstimate(run, config);
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
      renderCostEstimateMarkdown(estimate),
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
