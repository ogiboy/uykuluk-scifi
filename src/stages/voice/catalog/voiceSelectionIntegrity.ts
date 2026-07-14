import type { ProducerConfig } from "../../../config/schema.js";
import { SafeExitError } from "../../../core/errors.js";
import type { VoicePreviewEvidence, VoiceSelection } from "./voiceAuditionContracts.js";
import type { VoiceCandidates } from "./voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voiceCatalogDigest.js";
import { requireCatalogCandidate, requireElevenLabsCatalogConfig } from "./voiceCatalogGuards.js";

/** Verifies that preview evidence exactly corresponds to a catalog candidate. */
export function assertVoicePreviewMatchesCatalog(
  catalog: VoiceCandidates,
  candidate: ReturnType<typeof requireCatalogCandidate>,
  preview: VoicePreviewEvidence,
): void {
  if (
    preview.catalogDigest !== catalog.catalogDigest ||
    preview.candidate.voiceId !== candidate.voiceId ||
    preview.candidate.metadataDigest !== candidate.metadataDigest ||
    preview.model.modelId !== catalog.model.modelId ||
    preview.model.metadataDigest !== catalog.model.metadataDigest ||
    preview.source.urlSha256 !== candidate.preview.urlSha256
  ) {
    throw new SafeExitError("Voice preview does not match the current catalog candidate exactly.");
  }
}

/**
 * Verifies a persisted selection against its exact catalog, preview, and TTS configuration.
 */
export function assertVoiceSelectionMatchesEvidence(input: {
  catalogPath: string;
  previewPath: string;
  catalog: VoiceCandidates;
  preview: VoicePreviewEvidence;
  selection: VoiceSelection;
  config: ProducerConfig;
}): void {
  const { catalog, catalogPath, config, preview, previewPath, selection } = input;
  const settings = requireElevenLabsCatalogConfig(config, catalog);
  const candidate = requireCatalogCandidate(catalog, selection.voice.voiceId);
  if (candidate.productionEligibility.status === "blocked") {
    throw new SafeExitError("Voice selection is blocked in the current catalog.");
  }
  assertVoicePreviewMatchesCatalog(catalog, candidate, preview);
  const verifiedTurkish = candidate.verifiedLanguages.some(
    (language) =>
      language.language === settings.languageCode && language.modelId === settings.modelId,
  );
  const rightsRequired = catalog.subscription.productionUseStatus === "operator-rights-required";
  if (
    selection.catalog.path !== catalogPath ||
    selection.catalog.digest !== catalog.catalogDigest ||
    selection.preview.evidencePath !== previewPath ||
    selection.preview.digest !== preview.previewDigest ||
    selection.preview.audioPath !== preview.output.path ||
    selection.preview.audioSha256 !== preview.output.sha256 ||
    selection.voice.name !== candidate.name ||
    selection.voice.category !== candidate.category ||
    selection.voice.metadataDigest !== candidate.metadataDigest ||
    selection.voice.verifiedTurkish !== verifiedTurkish ||
    canonicalVoiceEvidenceDigest(selection.voice.productionEligibility) !==
      canonicalVoiceEvidenceDigest(candidate.productionEligibility) ||
    selection.model.modelId !== catalog.model.modelId ||
    selection.model.metadataDigest !== catalog.model.metadataDigest ||
    selection.model.languageCode !== settings.languageCode ||
    selection.model.maximumTextLengthPerRequest !== catalog.model.maximumTextLengthPerRequest ||
    selection.synthesis.outputFormat !== settings.outputFormat ||
    selection.synthesis.maxCharactersPerRequest !== settings.maxCharactersPerRequest ||
    selection.synthesis.voiceSettingsDigest !==
      canonicalVoiceEvidenceDigest(settings.voiceSettings) ||
    canonicalVoiceEvidenceDigest(selection.pricing) !==
      canonicalVoiceEvidenceDigest(catalog.pricing) ||
    selection.subscription.tier !== catalog.subscription.tier ||
    selection.subscription.productionUseStatus !== catalog.subscription.productionUseStatus ||
    selection.subscription.digest !== catalog.subscription.digest ||
    selection.productionRights.required !== rightsRequired ||
    selection.productionRights.confirmed !== rightsRequired
  ) {
    throw new SafeExitError("Voice selection does not match current catalog and preview evidence.");
  }
}
