import { SafeExitError } from "../../core/errors.js";
import type { CostReservationSummary } from "../../costs/costReservationStore.js";
import { executeReservedProviderOperation } from "../../costs/reservedProviderExecution.js";
import type { PreparedHostedVisualExecution } from "./hostedVisualExecutionPreparation.js";
import { spoolPaidHostedVisualResult } from "./hostedVisualGenerationSettlement.js";
import {
  requireHostedVisualResultDigest,
  requireSettledHostedVisualSpool,
} from "./hostedVisualSpoolEvidence.js";
import {
  createBlackForestLabsFlux2ProBatchAdapter,
  type BlackForestLabsFlux2ProBatchDependencies,
} from "./providers/blackForestLabsFlux2ProBatch.js";
import { createHostedVisualGenerationOperationId } from "./visualGenerationOperation.js";
import {
  loadHostedVisualGenerationSpoolForOperation,
  type LoadedHostedVisualGenerationSpool,
} from "./visualGenerationSpool.js";

/**
 * Executes one hosted visual generation batch under its approved plan and cost quote.
 *
 * The operation is tied to the run, plan digest, quote digest, and approval ID. Completed
 * executions return provider result evidence owned by the reservation; previously completed
 * executions recover that evidence without submitting duplicate generation.
 *
 * @param input - The run, approval-bound execution plan and quote, and optional provider dependencies.
 * @returns The settled visual result spool and associated cost reservation.
 * @throws SafeExitError If submission was definitely not sent or the reservation requires reconciliation.
 */
export async function executeHostedVisualGeneration(input: {
  runId: string;
  prepared: PreparedHostedVisualExecution;
  dependencies?: BlackForestLabsFlux2ProBatchDependencies & {
    afterSuccessfulExecutionCommitted?: () => Promise<void>;
  };
}): Promise<{ spool: LoadedHostedVisualGenerationSpool; reservation: CostReservationSummary }> {
  const { plan, approvedQuote } = input.prepared;
  const operationId = createHostedVisualGenerationOperationId({
    runId: input.runId,
    planDigest: plan.digest,
    quoteDigest: approvedQuote.quoteDigest,
    approvalId: approvedQuote.approvalId,
  });
  const adapter = createBlackForestLabsFlux2ProBatchAdapter({
    plan: plan.plan,
    bindingDigest: plan.digest,
    dependencies: input.dependencies,
  });
  const result = await executeReservedProviderOperation({
    runId: input.runId,
    stage: "imageGeneration",
    operationId,
    timeoutMs: hostedBatchTimeoutMs(plan.plan.settings.timeoutMs, plan.plan.scenes.length),
    adapter: spoolPaidHostedVisualResult(adapter, {
      runId: input.runId,
      operationId,
      plan: plan.plan,
      planDigest: plan.digest,
      approvedQuote,
    }),
    afterSuccessfulExecutionCommitted: input.dependencies?.afterSuccessfulExecutionCommitted,
  });
  if (result.status === "completed" || result.status === "already-completed") {
    const spool =
      result.status === "completed"
        ? result.value.spool
        : await loadHostedVisualGenerationSpoolForOperation(
            input.runId,
            operationId,
            requireHostedVisualResultDigest(result.reservation.resultEvidenceDigest),
          );
    return {
      spool: requireSettledHostedVisualSpool({
        spool,
        reservation: result.reservation,
        planDigest: plan.digest,
        approvedQuote,
      }),
      reservation: result.reservation,
    };
  }
  if (result.status === "definitely-not-sent") {
    throw new SafeExitError(
      "Hosted visual generation was not submitted; repair provider configuration and create a fresh cost quote before retrying.",
    );
  }
  throw new SafeExitError(
    "Hosted visual reservation requires reconciliation before retry; duplicate generation is blocked.",
  );
}

function hostedBatchTimeoutMs(sceneTimeoutMs: number, sceneCount: number): number {
  return Math.min(sceneTimeoutMs * sceneCount, 4 * 60 * 60 * 1_000);
}
