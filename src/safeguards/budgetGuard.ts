import { ProducerConfig } from "../config/schema";
import { SafeExitError } from "../core/errors";
import { CostEvent, RunRecord } from "../core/state";
import { appendLedgerEvent } from "../core/ledger";
import { appendCostEvent, readAllCostEvents, readCostEvents, sumCosts } from "../costs/costLedger";
import { nowIso } from "../utils/time";

export type BudgetGuardResult = {
  allowed: boolean;
  blockedReasons: string[];
  approvalRequired: boolean;
  estimatedStageCostUsd: number;
  cumulativeEstimatedRunCostUsd: number;
  perVideoBudgetUsd: number;
  dailyBudgetUsd: number;
  weeklyBudgetUsd: number;
};

export type BudgetGuardInput = {
  run: RunRecord;
  config: ProducerConfig;
  stage: string;
  provider: string;
  model?: string;
  estimatedUsd: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  recordCostEvent?: boolean;
};

export async function enforceBudget(input: BudgetGuardInput): Promise<BudgetGuardResult> {
  const result = await checkBudget(input);
  if (!result.allowed) {
    throw new SafeExitError(
      `Blocked: ${input.stage} budget guard failed. ${result.blockedReasons.join(" ")}`,
    );
  }
  if (result.approvalRequired) {
    await appendLedgerEvent({
      runId: input.run.runId,
      type: "GUARD_BLOCKED",
      stage: input.stage,
      message: "Budget threshold requires explicit approval.",
      data: result,
    });
    throw new SafeExitError(
      `Blocked: ${input.stage} budget requires explicit approval above ${input.config.budgets.requireApprovalAboveUsd} USD.`,
    );
  }
  return result;
}

export async function checkBudget(input: BudgetGuardInput): Promise<BudgetGuardResult> {
  const events = await readCostEvents(input.run.runId);
  const allEvents = await readAllCostEvents();
  const cumulativeBefore = sumCosts(events);
  const cumulativeAfter = cumulativeBefore + input.estimatedUsd;
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const dailyAfter =
    sumCosts(allEvents.filter((event) => Date.parse(event.createdAt) >= oneDayAgo)) +
    input.estimatedUsd;
  const weeklyAfter =
    sumCosts(allEvents.filter((event) => Date.parse(event.createdAt) >= oneWeekAgo)) +
    input.estimatedUsd;
  const blockedReasons: string[] = [];
  if (cumulativeAfter > input.config.budgets.perVideoUsd) {
    blockedReasons.push(
      `Per-video budget exceeded: ${cumulativeAfter} > ${input.config.budgets.perVideoUsd}.`,
    );
  }
  if (dailyAfter > input.config.budgets.dailyUsd) {
    blockedReasons.push(
      `Daily budget exceeded for local ledger estimate: ${dailyAfter} > ${input.config.budgets.dailyUsd}.`,
    );
  }
  if (weeklyAfter > input.config.budgets.weeklyUsd) {
    blockedReasons.push(
      `Weekly budget exceeded for local ledger estimate: ${weeklyAfter} > ${input.config.budgets.weeklyUsd}.`,
    );
  }
  const approvalRequired = input.estimatedUsd > input.config.budgets.requireApprovalAboveUsd;
  const result: BudgetGuardResult = {
    allowed: blockedReasons.length === 0,
    blockedReasons,
    approvalRequired,
    estimatedStageCostUsd: input.estimatedUsd,
    cumulativeEstimatedRunCostUsd: cumulativeAfter,
    perVideoBudgetUsd: input.config.budgets.perVideoUsd,
    dailyBudgetUsd: input.config.budgets.dailyUsd,
    weeklyBudgetUsd: input.config.budgets.weeklyUsd,
  };
  if (input.recordCostEvent ?? true) {
    const event: CostEvent = {
      runId: input.run.runId,
      stage: input.stage,
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedUsd: input.estimatedUsd,
      durationMs: input.durationMs,
      createdAt: nowIso(),
    };
    await appendCostEvent(event);
  }
  await appendLedgerEvent({
    runId: input.run.runId,
    type: result.allowed ? "GUARD_PASSED" : "GUARD_BLOCKED",
    stage: input.stage,
    message: result.allowed ? "Budget guard passed." : "Budget guard blocked the stage.",
    data: result,
  });
  return result;
}
