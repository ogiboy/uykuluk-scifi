import { SafeExitError } from "../../core/errors.js";
import type { RunRecord } from "../../core/state.js";
import { readCostEstimate } from "../../costs/costEstimate.js";
import { settleCostReservation } from "../../costs/costReservationService.js";
import {
  readCostReservationSummaries,
  type CostReservationSummary,
} from "../../costs/costReservationStore.js";
import {
  requireMatchingVoiceExecutionInput,
  type SelectedVoiceExecutionBinding,
} from "./voiceExecutionBinding.js";
import { createVoiceExecutionOperationId } from "./voiceExecutionOperation.js";
import {
  loadVoiceExecutionSpoolForOperation,
  type LoadedVoiceExecutionSpool,
} from "./voiceExecutionSpool.js";
import {
  settledVoiceSynthesisResult,
  type VoiceSynthesisExecutionResult,
} from "./voiceSynthesisExecution.js";
import type { VoiceoverPreparationV2 } from "./voiceoverPreparation.js";

export type RecoveredVoiceExecution = {
  mode: "elevenlabs";
  preparation: { text: string; evidence: VoiceoverPreparationV2; evidenceText: string };
  synthesis: VoiceSynthesisExecutionResult;
};

/**
 * Recovers a durably committed ElevenLabs voice execution without credentials or live provider requests.
 *
 * @param input - The run and source digest identifying the execution to recover.
 * @returns The recovered voice execution, or `undefined` when no matching committed execution is available.
 */
export async function recoverCommittedVoiceExecution(input: {
  run: RunRecord;
  sourceDigest: string;
}): Promise<RecoveredVoiceExecution | undefined> {
  const quote = await readCostEstimate(input.run.runId);
  const quoteLine = quote.estimate.stages.find((stage) => stage.stage === "tts");
  if (quoteLine?.provider !== "elevenlabs" || !quoteLine.model || !quoteLine.bindingDigest) {
    return undefined;
  }
  const approvalIds = new Set(
    input.run.approvals
      .filter(
        (approval) =>
          approval.target === "paid-generation-cost" && approval.approvedRef === quote.digest,
      )
      .map((approval) => approval.approvalId),
  );
  if (approvalIds.size === 0) return undefined;
  const reservations = (await readCostReservationSummaries(input.run.runId)).filter(
    (reservation) =>
      reservation.stage === "tts" &&
      reservation.provider === quoteLine.provider &&
      reservation.model === quoteLine.model &&
      reservation.bindingDigest === quoteLine.bindingDigest &&
      reservation.quoteDigest === quote.digest &&
      approvalIds.has(reservation.approvalId),
  );
  if (reservations.length === 0) return undefined;
  if (reservations.length !== 1) {
    throw new SafeExitError("Paid voice recovery found multiple matching execution reservations.");
  }
  const reservation = reservations[0];
  if (reservation.status === "RESERVED") return undefined;
  if (reservation.status === "RELEASED") {
    throw new SafeExitError(
      "ElevenLabs TTS was not sent; create a fresh voice selection, cost quote, and approval.",
    );
  }
  if (reservation.status === "UNCERTAIN" || reservation.status === "EXECUTION_STARTED") {
    throw new SafeExitError(
      "ElevenLabs TTS outcome is not durably committed; explicit cost reconciliation is required.",
    );
  }
  const resultEvidenceDigest = requireResultEvidenceDigest(reservation);
  const spool = await loadVoiceExecutionSpoolForOperation(
    input.run.runId,
    reservation.operationId,
    resultEvidenceDigest,
  );
  const binding = requireRecoveryBinding(spool, reservation, quoteLine.model, input.sourceDigest);
  const approvedQuote = {
    quoteDigest: reservation.quoteDigest,
    approvalId: reservation.approvalId,
  };
  const expectedOperationId = createVoiceExecutionOperationId({
    runId: input.run.runId,
    preparationDigest: spool.preparation.evidence.output.sha256,
    bindingDigest: binding.bindingDigest,
    ...approvedQuote,
  });
  if (reservation.operationId !== expectedOperationId) {
    throw new SafeExitError("Committed voice operation id does not match its pinned inputs.");
  }
  const settled =
    reservation.status === "SETTLEMENT_PENDING"
      ? await settleCostReservation({
          runId: input.run.runId,
          reservationId: reservation.reservationId,
          actualUsdMicros: requireActualUsdMicros(reservation),
          providerRequestIdHash: reservation.providerRequestIdHash,
          resultEvidenceDigest,
        })
      : reservation;
  return {
    mode: "elevenlabs",
    preparation: spool.preparation,
    synthesis: settledVoiceSynthesisResult({ spool, reservation: settled, binding, approvedQuote }),
  };
}

/**
 * Validates the execution binding and recovered spool against the historical reservation.
 *
 * @param spool - The committed voice execution spool to validate
 * @param reservation - The historical cost reservation associated with the execution
 * @param expectedModel - The model expected for the recovered execution
 * @param sourceDigest - The expected source content digest
 * @returns The validated voice execution binding
 */
function requireRecoveryBinding(
  spool: LoadedVoiceExecutionSpool,
  reservation: CostReservationSummary,
  expectedModel: string,
  sourceDigest: string,
): SelectedVoiceExecutionBinding {
  const binding = requireMatchingVoiceExecutionInput(spool.binding, {
    preparedText: spool.preparation.text,
    preparationDigest: spool.preparation.evidence.output.sha256,
  });
  if (
    binding.bindingDigest !== reservation.bindingDigest ||
    binding.model.modelId !== expectedModel ||
    spool.approvedQuote.quoteDigest !== reservation.quoteDigest ||
    spool.approvedQuote.approvalId !== reservation.approvalId ||
    spool.preparation.evidence.source.sha256 !== sourceDigest ||
    spool.actualUsdMicros !== reservation.actualUsdMicros ||
    spool.providerRequestIdHash !== reservation.providerRequestIdHash
  ) {
    throw new SafeExitError("Committed voice spool does not match its historical approval.");
  }
  return binding;
}

/**
 * Retrieves the result evidence digest required to recover a committed voice execution.
 *
 * @param reservation - The committed voice execution reservation.
 * @returns The reservation's result evidence digest.
 */
function requireResultEvidenceDigest(reservation: CostReservationSummary): string {
  if (!reservation.resultEvidenceDigest) {
    throw new SafeExitError("Committed voice reservation is missing result evidence.");
  }
  return reservation.resultEvidenceDigest;
}

/**
 * Retrieves the exact actual cost recorded for a committed voice reservation.
 *
 * @param reservation - The committed voice reservation containing the actual cost
 * @returns The reservation's actual cost in USD micros
 */
function requireActualUsdMicros(reservation: CostReservationSummary): number {
  if (reservation.actualUsdMicros === undefined) {
    throw new SafeExitError("Committed voice reservation is missing its exact cost.");
  }
  return reservation.actualUsdMicros;
}
