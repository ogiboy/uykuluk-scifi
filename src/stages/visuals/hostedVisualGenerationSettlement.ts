import { recordCostReservationExecutionResult } from "../../costs/costReservationService.js";
import type { ReservedProviderAdapter } from "../../costs/reservedProviderExecution.js";
import { sha256 } from "../../utils/hash.js";
import type { BlackForestLabsFlux2ProBatchResult } from "./providers/blackForestLabsFlux2ProBatch.js";
import type { HostedVisualGenerationPlan } from "./visualGenerationPlanContracts.js";
import {
  persistHostedVisualGenerationSpool,
  type LoadedHostedVisualGenerationSpool,
} from "./visualGenerationSpool.js";

type SpoolExecutionValue = Readonly<{ spool: LoadedHostedVisualGenerationSpool }>;

/**
 * Wraps a reserved provider adapter to persist successful hosted visual results before recording reservation cost evidence.
 *
 * Non-successful outcomes pass through unchanged. A successful outcome without a provider request ID becomes indeterminate.
 *
 * @param adapter - The provider adapter whose successful results are persisted.
 * @param input - Run, operation, plan, digest, and approved quote details used to associate the persisted result with its reservation and cost evidence.
 * @returns An adapter whose successful value contains the persisted spool and its evidence digest.
 */
export function spoolPaidHostedVisualResult(
  adapter: ReservedProviderAdapter<BlackForestLabsFlux2ProBatchResult>,
  input: {
    runId: string;
    operationId: string;
    plan: HostedVisualGenerationPlan;
    planDigest: string;
    approvedQuote: { approvalId: string; quoteDigest: string };
  },
): ReservedProviderAdapter<SpoolExecutionValue> {
  return {
    provider: adapter.provider,
    ...(adapter.model ? { model: adapter.model } : {}),
    ...(adapter.bindingDigest ? { bindingDigest: adapter.bindingDigest } : {}),
    async execute(context) {
      const outcome = await adapter.execute(context);
      if (outcome.kind !== "success") return outcome;
      if (!outcome.providerRequestId) {
        return { kind: "unknown", reason: "indeterminate" };
      }
      const spool = await persistHostedVisualGenerationSpool({
        runId: input.runId,
        operationId: input.operationId,
        plan: input.plan,
        planDigest: input.planDigest,
        approvedQuote: input.approvedQuote,
        reservationId: context.reservationId,
        actualUsdMicros: outcome.actualUsdMicros,
        providerRequestId: outcome.providerRequestId,
        result: outcome.value,
      });
      await recordCostReservationExecutionResult({
        runId: input.runId,
        reservationId: context.reservationId,
        actualUsdMicros: outcome.actualUsdMicros,
        providerRequestIdHash: sha256(outcome.providerRequestId),
        resultEvidenceDigest: spool.reference.digest,
      });
      return { ...outcome, resultEvidenceDigest: spool.reference.digest, value: { spool } };
    },
  };
}
