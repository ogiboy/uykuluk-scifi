import { SafeExitError } from "../core/errors.js";
import type { RunRecord } from "../core/state.js";
import { requireSettledHostedVisualSpool } from "../stages/visuals/hostedVisualSpoolEvidence.js";
import { loadHostedVisualGenerationSpoolForOperation } from "../stages/visuals/visualGenerationSpool.js";
import { loadVoiceExecutionSpoolAtProjectRoot } from "../stages/voice/voiceExecutionSpool.js";
import { readCostEstimateByDigestAtProjectRoot } from "./costEstimateStore.js";
import { readCostReservationSummariesAtProjectRoot } from "./costReservationStore.js";
import type { StagePricing } from "./pricing.js";

type QuotedStage = StagePricing & { enabled: boolean };

/**
 * Verifies whether the hosted visual quote stage has settled exactly once and its evidence matches the approved quote.
 *
 * @param run - Run record containing the approval and operation identifiers.
 * @param quoteDigest - Digest identifying the approved cost quote.
 * @param stages - Quoted stages containing the hosted visual stage definition.
 * @returns The settled actual cost in USD micros, or `null` when no matching reservation exists.
 * @throws SafeExitError If the reservation is incomplete or ambiguous, or if the approval, quote stage, or result evidence is inconsistent.
 */
export async function readSettledHostedVisualQuoteStage(
  run: RunRecord,
  quoteDigest: string,
  stages: readonly QuotedStage[],
): Promise<{ actualUsdMicros: number } | null> {
  const matching = (await readCostReservationSummariesAtProjectRoot(process.cwd(), run.runId))
    .filter((reservation) => reservation.stage === "imageGeneration")
    .filter((reservation) => reservation.quoteDigest === quoteDigest)
    .filter((reservation) => reservation.status !== "RELEASED");
  if (matching.length === 0) return null;
  if (matching.length !== 1 || matching[0]?.status !== "SETTLED") {
    throw new SafeExitError(
      "The active hosted visual quote has an incomplete or ambiguous reservation.",
    );
  }
  const reservation = matching[0];
  const quoteLine = stages.find((stage) => stage.stage === "imageGeneration");
  const approval = run.approvals.find(
    (item) =>
      item.approvalId === reservation.approvalId &&
      item.target === "paid-generation-cost" &&
      item.approvedRef === quoteDigest,
  );
  if (
    !approval ||
    !quoteLine?.enabled ||
    quoteLine.estimatedUsd <= 0 ||
    quoteLine.provider !== reservation.provider ||
    quoteLine.model !== reservation.model ||
    !quoteLine.bindingDigest ||
    quoteLine.bindingDigest !== reservation.bindingDigest ||
    !reservation.resultEvidenceDigest ||
    reservation.actualUsdMicros === undefined
  ) {
    throw new SafeExitError(
      "Settled hosted visual quote, approval, or reservation evidence is invalid.",
    );
  }
  const spool = await loadHostedVisualGenerationSpoolForOperation(
    run.runId,
    reservation.operationId,
    reservation.resultEvidenceDigest,
  );
  requireSettledHostedVisualSpool({
    spool,
    reservation,
    planDigest: quoteLine.bindingDigest,
    approvedQuote: { approvalId: approval.approvalId, quoteDigest },
  });
  return { actualUsdMicros: reservation.actualUsdMicros };
}

/**
 * Verifies that the exact TTS quote has one settled reservation and matching completion evidence.
 *
 * @param quoteDigest - Digest identifying the approved quote.
 * @param stages - Quoted stages containing the enabled TTS cost line.
 * @param projectRoot - Project root containing reservation and result evidence data.
 * @returns The settled actual cost in USD micros, or `null` when no active reservation matches the quote.
 * @throws SafeExitError If the reservation is incomplete or ambiguous, the TTS quote line is unavailable or disabled, or completion evidence does not match the reservation.
 */
export async function readSettledTtsQuoteStage(
  run: RunRecord,
  quoteDigest: string,
  stages: readonly QuotedStage[],
  projectRoot = process.cwd(),
): Promise<{ actualUsdMicros: number } | null> {
  const matching = (await readCostReservationSummariesAtProjectRoot(projectRoot, run.runId))
    .filter((reservation) => reservation.stage === "tts")
    .filter((reservation) => reservation.quoteDigest === quoteDigest)
    .filter((reservation) => reservation.status !== "RELEASED");
  if (matching.length === 0) return null;
  if (matching.length !== 1 || matching[0]?.status !== "SETTLED") {
    throw new SafeExitError("The active TTS quote has an incomplete or ambiguous reservation.");
  }
  const quoteLine = stages.find((stage) => stage.stage === "tts");
  if (!quoteLine?.enabled || quoteLine.estimatedUsd <= 0) {
    throw new SafeExitError("Settled TTS quote line is missing or disabled.");
  }
  const result = await requireSettledTtsResult(run, matching[0], quoteLine, projectRoot);
  return { actualUsdMicros: result.actualUsdMicros };
}

/**
 * Replaces a durably settled TTS stage with disabled, zero-cost completion evidence.
 *
 * @param run - Run record containing the approval and reservation history.
 * @param stages - Quoted stages to update.
 * @param projectRoot - Project root containing cost reservations and execution evidence.
 * @returns A new stage array with settled TTS evidence embedded in the replacement stage.
 * @throws `SafeExitError` if the TTS reservation is active, uncertain, duplicated, incomplete, or inconsistent with its quote or execution evidence.
 */
export async function suppressSettledTtsStage(
  run: RunRecord,
  stages: readonly QuotedStage[],
  projectRoot = process.cwd(),
): Promise<QuotedStage[]> {
  const reservations = (await readCostReservationSummariesAtProjectRoot(projectRoot, run.runId))
    .filter((reservation) => reservation.stage === "tts")
    .filter((reservation) => reservation.status !== "RELEASED");
  if (reservations.length === 0) return [...stages];
  const nonterminal = reservations.filter((reservation) => reservation.status !== "SETTLED");
  if (nonterminal.length > 0) {
    throw new SafeExitError(
      "A prior TTS reservation is active or uncertain; reconcile it before creating another paid quote.",
    );
  }
  if (reservations.length !== 1) {
    throw new SafeExitError("Multiple settled TTS reservations require operator reconciliation.");
  }
  const reservation = reservations[0];
  const quote = await readCostEstimateByDigestAtProjectRoot(
    projectRoot,
    run,
    reservation.quoteDigest,
  );
  const originalLine = quote.estimate.stages.find((stage) => stage.stage === "tts");
  if (!originalLine) throw new SafeExitError("Settled TTS quote line is missing.");
  const { actualUsdMicros, resultEvidenceDigest } = await requireSettledTtsResult(
    run,
    reservation,
    originalLine,
    projectRoot,
  );
  return stages.map((stage) =>
    stage.stage === "tts"
      ? {
          stage: "tts",
          provider: reservation.provider,
          ...(reservation.model ? { model: reservation.model } : {}),
          ...(reservation.bindingDigest ? { bindingDigest: reservation.bindingDigest } : {}),
          bindingSummary: {
            kind: "settled-paid-stage" as const,
            stage: "tts",
            originalQuoteDigest: reservation.quoteDigest,
            originalApprovalId: reservation.approvalId,
            reservationId: reservation.reservationId,
            resultEvidenceDigest,
            actualUsdMicros,
          },
          enabled: false,
          estimatedUsd: 0,
        }
      : stage,
  );
}

/**
 * Verifies a settled TTS reservation and its execution evidence against the approved quote.
 *
 * @param run - Run containing the approval for the paid generation cost.
 * @param reservation - Settled TTS reservation whose cost and evidence are being verified.
 * @param quoteLine - TTS quote stage that must match the reservation binding.
 * @param projectRoot - Project root containing the execution result spool.
 * @returns The settled actual cost in USD micros and the digest identifying its result evidence.
 * @throws SafeExitError If the approval, reservation, quote binding, or result spool is invalid or inconsistent.
 */
async function requireSettledTtsResult(
  run: RunRecord,
  reservation: Awaited<ReturnType<typeof readCostReservationSummariesAtProjectRoot>>[number],
  quoteLine: QuotedStage,
  projectRoot: string,
): Promise<{ actualUsdMicros: number; resultEvidenceDigest: string }> {
  const approval = run.approvals.find(
    (item) =>
      item.approvalId === reservation.approvalId &&
      item.target === "paid-generation-cost" &&
      item.approvedRef === reservation.quoteDigest,
  );
  if (
    reservation.status !== "SETTLED" ||
    !approval ||
    quoteLine.provider !== reservation.provider ||
    quoteLine.model !== reservation.model ||
    quoteLine.bindingDigest !== reservation.bindingDigest ||
    !reservation.resultEvidenceDigest ||
    reservation.actualUsdMicros === undefined
  ) {
    throw new SafeExitError("Settled TTS quote, approval, or reservation evidence is invalid.");
  }
  const spool = await loadVoiceExecutionSpoolAtProjectRoot(projectRoot, run.runId, {
    operationId: reservation.operationId,
    path: `operations/tts/${reservation.operationId}/result.json`,
    digest: reservation.resultEvidenceDigest,
  });
  if (
    spool.binding.bindingDigest !== reservation.bindingDigest ||
    spool.approvedQuote.quoteDigest !== reservation.quoteDigest ||
    spool.approvedQuote.approvalId !== reservation.approvalId ||
    spool.actualUsdMicros !== reservation.actualUsdMicros
  ) {
    throw new SafeExitError("Settled TTS result spool does not match its historical reservation.");
  }
  return {
    actualUsdMicros: reservation.actualUsdMicros,
    resultEvidenceDigest: reservation.resultEvidenceDigest,
  };
}
