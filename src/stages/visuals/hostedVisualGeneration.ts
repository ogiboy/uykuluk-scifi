import { loadConfig } from "../../config/config.js";
import { SafeExitError } from "../../core/errors.js";
import { loadRun } from "../../core/runStore.js";
import type { HostedVisualExecutionConfirmation } from "./hostedVisualExecutionConfirmation.js";
import { prepareHostedVisualExecution } from "./hostedVisualExecutionPreparation.js";
import { executeHostedVisualGeneration } from "./hostedVisualGenerationExecution.js";
import { recoverCommittedHostedVisualGeneration } from "./hostedVisualGenerationRecovery.js";
import { applySettledHostedVisuals } from "./hostedVisualManifestApply.js";
import type { BlackForestLabsFlux2ProBatchDependencies } from "./providers/blackForestLabsFlux2ProBatch.js";
import type { VisualManifest } from "./visualContracts.js";

/**
 * Executes one approved FLUX.2 Pro hosted batch and promotes its settled images into review.
 *
 * Recovers an already committed generation when available; otherwise validates the
 * execution confirmation, prepares and runs the batch, and applies its settled
 * visual evidence. Execution and credential errors propagate to the caller.
 *
 * @param input - Run identifier, execution confirmation, and optional hosted-provider dependencies.
 * @returns The visual manifest containing the promoted settled images.
 */
export async function generateHostedVisuals(input: {
  runId: string;
  confirmation: HostedVisualExecutionConfirmation;
  dependencies?: BlackForestLabsFlux2ProBatchDependencies & {
    afterSuccessfulExecutionCommitted?: () => Promise<void>;
  };
}): Promise<VisualManifest> {
  const config = await loadConfig();
  const run = await loadRun(input.runId);
  const recovered = await recoverCommittedHostedVisualGeneration({
    run,
    confirmation: input.confirmation,
  });
  if (recovered) {
    return applySettledHostedVisuals({ runId: input.runId, ...recovered });
  }
  const prepared = await prepareHostedVisualExecution({
    run,
    config,
    confirmation: input.confirmation,
  });
  requireBlackForestLabsCredential(input.dependencies);
  const executed = await executeHostedVisualGeneration({
    runId: input.runId,
    prepared,
    dependencies: input.dependencies,
  });
  return applySettledHostedVisuals({
    runId: input.runId,
    plan: prepared.plan,
    spool: executed.spool,
    reservation: executed.reservation,
  });
}

function requireBlackForestLabsCredential(
  dependencies: BlackForestLabsFlux2ProBatchDependencies | undefined,
): void {
  const apiKey = (dependencies?.readApiKey ?? (() => process.env.BFL_API_KEY))()?.trim();
  if (!apiKey) {
    throw new SafeExitError(
      "Hosted visual generation requires BFL_API_KEY in the server environment.",
    );
  }
}
