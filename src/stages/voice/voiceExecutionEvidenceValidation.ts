import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { artifactPathAtProjectRoot } from "../../core/artifactPaths.js";
import { SafeExitError } from "../../core/errors.js";
import type { RunRecord } from "../../core/state.js";
import { readCostEstimateByDigestAtProjectRoot } from "../../costs/costEstimateStore.js";
import { readCostEventsAtProjectRoot } from "../../costs/costLedger.js";
import { readCostReservationSummariesAtProjectRoot } from "../../costs/costReservationStore.js";
import { usdToMicros } from "../../costs/money.js";
import { voiceSelectionSchema } from "./catalog/voiceAuditionContracts.js";
import { voiceCandidatesSchema } from "./catalog/voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./catalog/voiceCatalogDigest.js";
import {
  requireMatchingVoiceExecutionInput,
  requireSelectedVoiceExecutionBinding,
} from "./voiceExecutionBinding.js";
import { paidVoiceExecutionEvidenceSchema } from "./voiceExecutionEvidence.js";
import { createVoiceExecutionOperationId } from "./voiceExecutionOperation.js";
import { requireMatchingVoiceExecutionPreflight } from "./voiceExecutionPreflight.js";
import { loadVoiceExecutionSpoolAtProjectRoot } from "./voiceExecutionSpool.js";
import type { VoiceoverAudioMeta } from "./voiceoverEvidence.js";

/**
 * Validates persisted evidence for a paid ElevenLabs voice execution.
 *
 * @param run - The run containing the persisted execution, approval, reservation, and cost evidence
 * @param meta - The voice execution metadata and referenced evidence
 * @throws SafeExitError If required evidence is missing or inconsistent
 */
export async function assertPaidVoiceExecutionEvidence(
  run: RunRecord,
  meta: VoiceoverAudioMeta,
): Promise<void> {
  return assertPaidVoiceExecutionEvidenceAtProjectRoot(process.cwd(), run, meta);
}

/**
 * Validates paid ElevenLabs voice execution evidence against the prepared input, approval, cost
 * reservation, provider spool, and final output.
 *
 * Validation is skipped for other voice modes. A `SafeExitError` is thrown when required evidence
 * is missing or any persisted evidence, approval, settlement, cost event, or output digest
 * mismatches.
 *
 * @param projectRoot - The project root containing the run's persisted artifacts and cost records.
 * @param run - The run record containing approvals and artifact registrations.
 * @param meta - The voice output metadata and paid execution evidence to validate.
 */
export async function assertPaidVoiceExecutionEvidenceAtProjectRoot(
  projectRoot: string,
  run: RunRecord,
  meta: VoiceoverAudioMeta,
): Promise<void> {
  if (meta.mode !== "elevenlabs") return;
  const paid = paidVoiceExecutionEvidenceSchema.parse(meta.paidExecution);
  const preparation = meta.source.preparation;
  if (!preparation) {
    throw new SafeExitError("Paid voice execution requires prepared-text evidence.");
  }
  const preparedText = await readFile(
    artifactPathAtProjectRoot(projectRoot, run.runId, preparation.path),
    "utf8",
  );
  const binding = requireMatchingVoiceExecutionInput(paid.binding, {
    preparedText,
    preparationDigest: preparation.sha256,
  });
  await requirePinnedBindingArtifacts(projectRoot, run, binding);
  requireMatchingBinding(meta, paid, binding);

  const quote = await readCostEstimateByDigestAtProjectRoot(projectRoot, run, paid.quoteDigest);
  const quoteLine = quote.estimate.stages.find((stage) => stage.stage === "tts");
  if (
    paid.quoteDigest !== quote.digest ||
    quoteLine?.provider !== "elevenlabs" ||
    quoteLine.model !== binding.model.modelId ||
    quoteLine.bindingDigest !== binding.bindingDigest
  ) {
    throw new SafeExitError("Paid execution quote does not match the selected voice binding.");
  }
  const approval = run.approvals.find((item) => item.approvalId === paid.approvalId);
  if (approval?.target !== "paid-generation-cost" || approval.approvedRef !== quote.digest) {
    throw new SafeExitError(
      "Paid execution approval does not match the approved reservation quote.",
    );
  }
  const reservation = (
    await readCostReservationSummariesAtProjectRoot(projectRoot, run.runId)
  ).find((item) => item.reservationId === paid.reservationId);
  if (
    reservation?.status !== "SETTLED" ||
    reservation.operationId !== paid.operationId ||
    reservation.approvalId !== paid.approvalId ||
    reservation.quoteDigest !== paid.quoteDigest ||
    reservation.bindingDigest !== paid.bindingDigest ||
    reservation.actualUsdMicros !== paid.actualUsdMicros ||
    reservation.resultEvidenceDigest !== paid.resultSpool.digest
  ) {
    throw new SafeExitError("Paid execution reservation or settlement evidence does not match.");
  }
  const spool = await loadVoiceExecutionSpoolAtProjectRoot(
    projectRoot,
    run.runId,
    paid.resultSpool,
  );
  if (
    spool.binding.bindingDigest !== binding.bindingDigest ||
    spool.approvedQuote.quoteDigest !== paid.quoteDigest ||
    spool.approvedQuote.approvalId !== paid.approvalId ||
    spool.actualUsdMicros !== paid.actualUsdMicros ||
    spool.audio.providerBilling?.derivedUsdMicros !== paid.actualUsdMicros ||
    JSON.stringify(spool.audio.providerBilling) !== JSON.stringify(paid.billing) ||
    spool.reference.operationId !== paid.operationId ||
    spool.alignmentReference.digest !== meta.alignment?.sha256 ||
    spool.alignmentReference.characterCount !== meta.alignment?.characterCount ||
    spool.normalizedAlignmentReference?.digest !==
      (meta.schemaVersion === 2 ? meta.normalizedAlignment?.sha256 : undefined) ||
    spool.normalizedAlignmentReference?.characterCount !==
      (meta.schemaVersion === 2 ? meta.normalizedAlignment?.characterCount : undefined) ||
    createHash("sha256").update(spool.audio.buffer).digest("hex") !== meta.output.sha256
  ) {
    throw new SafeExitError(
      "Paid execution provider spool audio or alignment does not match final voice evidence.",
    );
  }
  const linkedCostEvents = (await readCostEventsAtProjectRoot(projectRoot, run.runId)).filter(
    (event) => event.reservationId === paid.reservationId,
  );
  const linkedCostEvent = linkedCostEvents[0];
  if (
    linkedCostEvents.length !== 1 ||
    linkedCostEvent?.stage !== "tts" ||
    linkedCostEvent.provider !== binding.provider ||
    linkedCostEvent.model !== binding.model.modelId ||
    linkedCostEvent.actualUsd === undefined ||
    linkedCostEvent.resultEvidenceDigest !== paid.resultSpool.digest ||
    usdToMicros(linkedCostEvent.actualUsd) !== paid.actualUsdMicros
  ) {
    throw new SafeExitError("Paid execution is missing its exact reservation-linked cost event.");
  }
  const expectedOperationId = createVoiceExecutionOperationId({
    runId: run.runId,
    preparationDigest: preparation.sha256,
    bindingDigest: binding.bindingDigest,
    quoteDigest: paid.quoteDigest,
    approvalId: paid.approvalId,
  });
  if (paid.operationId !== expectedOperationId) {
    throw new SafeExitError(
      "Paid execution operation id does not match the selected voice binding.",
    );
  }
}

/**
 * Verifies that paid execution evidence, preflight validation, and provider metadata match the pinned voice binding.
 *
 * @param meta - Voiceover metadata containing the provider configuration to validate.
 * @param paid - Persisted evidence for the paid voice execution.
 * @param binding - Pinned voice execution binding.
 */
function requireMatchingBinding(
  meta: VoiceoverAudioMeta,
  paid: NonNullable<VoiceoverAudioMeta["paidExecution"]>,
  binding: ReturnType<typeof requireSelectedVoiceExecutionBinding>,
): void {
  const receipt = requireMatchingVoiceExecutionPreflight(paid.liveValidation, binding);
  if (
    paid.bindingDigest !== paid.binding.bindingDigest ||
    paid.bindingDigest !== binding.bindingDigest ||
    paid.selection.path !== binding.selection.path ||
    paid.selection.digest !== binding.selection.digest ||
    paid.selection.catalogPath !== binding.catalog.path ||
    paid.selection.catalogDigest !== binding.catalog.digest ||
    paid.selection.voiceMetadataDigest !== binding.voice.metadataDigest ||
    paid.selection.modelMetadataDigest !== binding.model.metadataDigest ||
    paid.selection.pricingDigest !== binding.pricing.digest ||
    paid.selection.subscriptionDigest !== binding.subscription.digest ||
    receipt.bindingDigest !== binding.bindingDigest ||
    receipt.voiceMetadataDigest !== binding.voice.metadataDigest ||
    receipt.modelMetadataDigest !== binding.model.metadataDigest ||
    receipt.pricingDigest !== binding.pricing.digest ||
    meta.provider?.voiceId !== binding.voice.voiceId ||
    meta.provider.modelId !== binding.model.modelId ||
    meta.provider.outputFormat !== binding.synthesis.outputFormat
  ) {
    throw new SafeExitError("Paid execution evidence does not match its pinned voice binding.");
  }
}

/**
 * Verifies that the persisted voice selection and candidate catalog artifacts match the pinned binding.
 *
 * @param run - Run state containing the registered binding artifacts
 * @param binding - Pinned voice execution binding to validate
 */
async function requirePinnedBindingArtifacts(
  projectRoot: string,
  run: RunRecord,
  binding: ReturnType<typeof requireSelectedVoiceExecutionBinding>,
): Promise<void> {
  if (
    !run.artifacts.includes(binding.selection.path) ||
    !run.artifacts.includes(binding.catalog.path)
  ) {
    throw new SafeExitError("Paid execution binding artifacts are not registered in run state.");
  }
  const selection = voiceSelectionSchema.parse(
    JSON.parse(
      await readFile(
        artifactPathAtProjectRoot(projectRoot, run.runId, binding.selection.path),
        "utf8",
      ),
    ) as unknown,
  );
  const { selectionDigest, ...selectionInput } = selection;
  if (
    selection.runId !== run.runId ||
    selectionDigest !== binding.selection.digest ||
    canonicalVoiceEvidenceDigest(selectionInput) !== selectionDigest ||
    selection.catalog.path !== binding.catalog.path ||
    selection.catalog.digest !== binding.catalog.digest ||
    selection.voice.voiceId !== binding.voice.voiceId ||
    selection.voice.metadataDigest !== binding.voice.metadataDigest ||
    selection.model.modelId !== binding.model.modelId ||
    selection.model.metadataDigest !== binding.model.metadataDigest ||
    selection.pricing.digest !== binding.pricing.digest ||
    selection.subscription.digest !== binding.subscription.digest
  ) {
    throw new SafeExitError("Paid execution selection artifact does not match its pinned binding.");
  }
  const catalog = voiceCandidatesSchema.parse(
    JSON.parse(
      await readFile(
        artifactPathAtProjectRoot(projectRoot, run.runId, binding.catalog.path),
        "utf8",
      ),
    ) as unknown,
  );
  const { catalogDigest, ...catalogInput } = catalog;
  const voice = catalog.candidates.find((candidate) => candidate.voiceId === binding.voice.voiceId);
  if (
    catalog.runId !== run.runId ||
    catalogDigest !== binding.catalog.digest ||
    canonicalVoiceEvidenceDigest(catalogInput) !== catalogDigest ||
    catalog.model.metadataDigest !== binding.model.metadataDigest ||
    catalog.pricing.digest !== binding.pricing.digest ||
    catalog.subscription.digest !== binding.subscription.digest ||
    voice?.metadataDigest !== binding.voice.metadataDigest
  ) {
    throw new SafeExitError("Paid execution catalog artifact does not match its pinned binding.");
  }
}
