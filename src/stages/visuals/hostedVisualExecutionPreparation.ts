import type { ProducerConfig } from "../../config/schema.js";
import { SafeExitError } from "../../core/errors.js";
import { appendLedgerEvent } from "../../core/ledger.js";
import type { RunRecord } from "../../core/state.js";
import { loadApprovedQuoteLine } from "../../costs/costReservationContext.js";
import {
  hostedVisualExecutionConfirmationMatches,
  type HostedVisualExecutionConfirmation,
} from "./hostedVisualExecutionConfirmation.js";
import {
  loadHostedVisualGenerationPlan,
  type LoadedHostedVisualGenerationPlan,
} from "./visualGenerationPlanStore.js";

export type PreparedHostedVisualExecution = Readonly<{
  approvedQuote: { approvalId: string; quoteDigest: string };
  plan: LoadedHostedVisualGenerationPlan;
}>;

/**
 * Revalidates the active hosted visual plan, approved quote, and operator confirmation before provider submission or spend.
 *
 * Records a guard-block event and throws `SafeExitError` when quote validation fails, the quote does not match the plan, or confirmation is missing or stale.
 *
 * @param input - Run and producer configuration used to load the active plan, plus optional confirmation of the current plan and quote.
 * @returns The validated hosted visual generation plan and approved quote identifiers.
 * @throws `SafeExitError` If the approved quote cannot be validated or does not match the plan, or if operator confirmation is missing or stale.
 */
export async function prepareHostedVisualExecution(
  input: Readonly<{
    run: RunRecord;
    config: ProducerConfig;
    confirmation?: HostedVisualExecutionConfirmation;
  }>,
): Promise<PreparedHostedVisualExecution> {
  const plan = await loadHostedVisualGenerationPlan(input.run, input.config);
  let approved: Awaited<ReturnType<typeof loadApprovedQuoteLine>>;
  try {
    approved = await loadApprovedQuoteLine(input.run.runId, "imageGeneration");
  } catch (error) {
    await recordHostedVisualGuardBlock(input.run.runId, "approved-quote-validation-failed", {
      planDigest: plan.digest,
    });
    if (error instanceof SafeExitError) throw error;
    throw new SafeExitError("Approved hosted visual quote validation failed safely.");
  }
  if (
    approved.provider !== plan.plan.provider ||
    approved.model !== plan.plan.model ||
    approved.bindingDigest !== plan.digest ||
    approved.bindingSummary?.kind !== "hosted-visual-generation" ||
    approved.bindingSummary.planDigest !== plan.digest
  ) {
    await recordHostedVisualGuardBlock(input.run.runId, "approved-quote-binding-mismatch", {
      approvalId: approved.approvalId,
      approvedBindingDigest: approved.bindingDigest,
      planDigest: plan.digest,
      quoteDigest: approved.quoteDigest,
    });
    throw new SafeExitError(
      "Approved hosted visual quote does not match the active generation plan.",
    );
  }
  if (
    !input.confirmation ||
    !hostedVisualExecutionConfirmationMatches(input.confirmation, {
      approvalId: approved.approvalId,
      bindingDigest: plan.digest,
      quoteDigest: approved.quoteDigest,
    })
  ) {
    await recordHostedVisualGuardBlock(
      input.run.runId,
      input.confirmation
        ? "hosted-execution-confirmation-mismatch"
        : "hosted-execution-confirmation-missing",
      {
        approvalId: approved.approvalId,
        planDigest: plan.digest,
        quoteDigest: approved.quoteDigest,
      },
    );
    throw new SafeExitError(
      input.confirmation
        ? "Hosted visual confirmation is stale. Refresh the run and confirm the current approved quote."
        : "Hosted visual generation requires explicit confirmation of the current plan, quote, and approval.",
    );
  }
  return {
    plan,
    approvedQuote: { approvalId: approved.approvalId, quoteDigest: approved.quoteDigest },
  };
}

/**
 * Records a ledger event when hosted visual execution is blocked before provider submission.
 *
 * @param runId - The run whose ledger receives the guard-block event
 * @param reason - The reason execution was blocked
 * @param data - Additional evidence associated with the block
 */
async function recordHostedVisualGuardBlock(
  runId: string,
  reason: string,
  data: Record<string, unknown>,
): Promise<void> {
  await appendLedgerEvent({
    runId,
    type: "GUARD_BLOCKED",
    stage: "visuals-hosted-execution-preflight",
    message: "Hosted visual execution was blocked before provider submission.",
    data: { reason, ...data },
  });
}
