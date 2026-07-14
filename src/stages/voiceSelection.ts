import { loadConfig } from "../config/config.js";
import { registerRunArtifactPath } from "../core/artifactRegistration.js";
import { registeredArtifactSetRevision } from "../core/artifactRevision.js";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, mutateRun } from "../core/runStore.js";
import { requireState } from "../safeguards/approvalGuard.js";
import { writeJsonFile } from "../utils/json.js";
import { createId, nowIso } from "../utils/time.js";
import { verifyProductionPackage } from "./production/productionPackageIntegrity.js";
import {
  isVoicePreviewAudioArtifactPath,
  isVoicePreviewEvidenceArtifactPath,
  isVoicePreviewFailureArtifactPath,
  isVoiceSelectionArtifactPath,
  voiceSelectionArtifactPath,
  voiceSelectionInputSchema,
  voiceSelectionSchema,
  type VoiceSelection,
  type VoiceSelectionInput,
} from "./voice/catalog/voiceAuditionContracts.js";
import {
  isVoiceCandidatesArtifactPath,
  isVoiceCatalogFailureArtifactPath,
} from "./voice/catalog/voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voice/catalog/voiceCatalogDigest.js";
import {
  requireCatalogCandidate,
  requireElevenLabsCatalogConfig,
} from "./voice/catalog/voiceCatalogGuards.js";
import {
  readVoiceCandidatesWithPath,
  readVoicePreviewEvidenceWithPath,
  requireCurrentVoiceCatalog,
} from "./voice/catalog/voiceCatalogStore.js";
import { assertVoicePreviewMatchesCatalog } from "./voice/catalog/voiceSelectionIntegrity.js";

type SelectVoiceOptions = { beforeCommit?: () => Promise<void> };

/**
 * Records an attributable voice selection from an exact catalog and preview match without synthesizing production speech.
 *
 * @param runId - The run receiving the voice selection artifact
 * @param input - The voice candidate, reviewer, and production-rights confirmation details
 * @param options - Optional hook invoked before committing the selection
 * @returns The validated voice selection record
 */
export async function selectVoice(
  runId: string,
  input: VoiceSelectionInput,
  options: SelectVoiceOptions = {},
): Promise<VoiceSelection> {
  const parsed = voiceSelectionInputSchema.parse(input);
  const config = await loadConfig();
  const run = await loadRun(runId);
  await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "voice-select");
  const packageSnapshot = await verifyProductionPackage(run);
  const startingSelectionRevision = await voiceSelectionDependencyRevision(run, parsed.voiceId);
  const catalogRecord = await readVoiceCandidatesWithPath(runId);
  const catalog = catalogRecord.catalog;
  requireCurrentVoiceCatalog(catalog);
  const settings = requireElevenLabsCatalogConfig(config, catalog);
  const candidate = requireCatalogCandidate(catalog, parsed.voiceId);
  if (candidate.productionEligibility.status === "blocked") {
    throw new SafeExitError("Blocked voice candidates cannot be selected for production.");
  }
  const previewRecord = await readVoicePreviewEvidenceWithPath(runId, parsed.voiceId);
  const preview = previewRecord.evidence;
  assertVoicePreviewMatchesCatalog(catalog, candidate, preview);

  const productionRightsRequired =
    catalog.subscription.productionUseStatus === "operator-rights-required";
  if (productionRightsRequired && !parsed.confirmProductionRights) {
    throw new SafeExitError(
      "Paid-tier voice selection requires explicit confirmation of production usage rights.",
    );
  }
  const selectionInput = {
    schemaVersion: 1 as const,
    runId,
    selectedAt: nowIso(),
    selectedBy: parsed.reviewedBy,
    notes: parsed.notes,
    provider: "elevenlabs" as const,
    catalog: { path: catalogRecord.path, digest: catalog.catalogDigest },
    preview: {
      evidencePath: previewRecord.path,
      digest: preview.previewDigest,
      audioPath: preview.output.path,
      audioSha256: preview.output.sha256,
    },
    voice: {
      voiceId: candidate.voiceId,
      name: candidate.name,
      category: candidate.category,
      metadataDigest: candidate.metadataDigest,
      verifiedTurkish: candidate.verifiedLanguages.some(
        (language) =>
          language.language === settings.languageCode && language.modelId === settings.modelId,
      ),
      productionEligibility: candidate.productionEligibility,
    },
    model: {
      modelId: catalog.model.modelId,
      metadataDigest: catalog.model.metadataDigest,
      languageCode: settings.languageCode,
      maximumTextLengthPerRequest: catalog.model.maximumTextLengthPerRequest,
    },
    synthesis: {
      outputFormat: settings.outputFormat,
      maxCharactersPerRequest: settings.maxCharactersPerRequest,
      voiceSettingsDigest: canonicalVoiceEvidenceDigest(settings.voiceSettings),
    },
    pricing: catalog.pricing,
    subscription: {
      tier: catalog.subscription.tier,
      productionUseStatus: catalog.subscription.productionUseStatus,
      digest: catalog.subscription.digest,
    },
    productionRights: {
      required: productionRightsRequired,
      confirmed: productionRightsRequired && parsed.confirmProductionRights,
    },
  };
  const selection = voiceSelectionSchema.parse({
    ...selectionInput,
    selectionDigest: canonicalVoiceEvidenceDigest(selectionInput),
  });
  const selectionPath = voiceSelectionArtifactPath(createId("selection"));
  await writeJsonFile(artifactPath(runId, selectionPath), selection);
  await options.beforeCommit?.();

  await mutateRun(runId, async (current) => {
    await requireState(current, "PRODUCTION_PACKAGE_GENERATED", "voice-select");
    const currentPackage = await verifyProductionPackage(current);
    if (currentPackage.digest !== packageSnapshot.digest) {
      throw new SafeExitError("Production package changed while voice selection was prepared.");
    }
    if (
      (await voiceSelectionDependencyRevision(current, parsed.voiceId)) !==
      startingSelectionRevision
    ) {
      throw new SafeExitError("Voice evidence changed while selection was prepared.");
    }
    const currentCatalogRecord = await readVoiceCandidatesWithPath(runId);
    const currentCatalog = currentCatalogRecord.catalog;
    requireCurrentVoiceCatalog(currentCatalog);
    const currentCandidate = requireCatalogCandidate(currentCatalog, parsed.voiceId);
    const currentPreviewRecord = await readVoicePreviewEvidenceWithPath(runId, parsed.voiceId);
    const currentPreview = currentPreviewRecord.evidence;
    assertVoicePreviewMatchesCatalog(currentCatalog, currentCandidate, currentPreview);
    if (
      currentCatalogRecord.path !== catalogRecord.path ||
      currentCatalog.catalogDigest !== catalog.catalogDigest ||
      currentPreviewRecord.path !== previewRecord.path ||
      currentPreview.previewDigest !== preview.previewDigest
    ) {
      throw new SafeExitError("Voice evidence changed while selection was prepared.");
    }
    return { run: registerRunArtifactPath(current, selectionPath), value: undefined };
  });
  await appendLedgerEvent({
    runId,
    type: "ARTIFACT_WRITTEN",
    stage: "voice-select",
    message: `Wrote ${selectionPath}.`,
    data: { path: selectionPath },
  });
  await appendLedgerEvent({
    runId,
    type: "REVIEW_DECISION_RECORDED",
    stage: "voice-select",
    message: "Operator selected an exact auditioned voice candidate.",
    data: {
      voiceId: candidate.voiceId,
      path: selectionPath,
      selectionDigest: selection.selectionDigest,
      previewDigest: preview.previewDigest,
      selectedBy: selection.selectedBy,
    },
  });
  return selection;
}

/**
 * Determines the revision of artifacts that can affect voice selection for a run.
 *
 * @param run - The run whose registered artifacts are evaluated
 * @param voiceId - The voice whose preview artifacts are included
 * @returns The revision identifier for the relevant registered artifacts
 */
async function voiceSelectionDependencyRevision(
  run: Awaited<ReturnType<typeof loadRun>>,
  voiceId: string,
): Promise<string> {
  return registeredArtifactSetRevision(run, (relativePath) => {
    return (
      isVoiceCandidatesArtifactPath(relativePath) ||
      isVoiceCatalogFailureArtifactPath(relativePath) ||
      isVoicePreviewAudioArtifactPath(relativePath, voiceId) ||
      isVoicePreviewEvidenceArtifactPath(relativePath, voiceId) ||
      isVoicePreviewFailureArtifactPath(relativePath, voiceId) ||
      isVoiceSelectionArtifactPath(relativePath)
    );
  });
}
