import { readFile } from "node:fs/promises";

import { loadConfig } from "../../../config/config.js";
import type { ProducerConfig } from "../../../config/schema.js";
import { latestRegisteredArtifactPath } from "../../../core/artifactRegistration.js";
import { artifactPath } from "../../../core/artifacts.js";
import { SafeExitError } from "../../../core/errors.js";
import { loadRun } from "../../../core/runStore.js";
import {
  isVoiceSelectionArtifactPath,
  voiceSelectionSchema,
  type VoicePreviewEvidence,
  type VoiceSelection,
} from "./voiceAuditionContracts.js";
import type { VoiceCandidates } from "./voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voiceCatalogDigest.js";
import { requireCatalogCandidate, requireElevenLabsCatalogConfig } from "./voiceCatalogGuards.js";
import {
  readVoiceCandidatesWithPath,
  readVoicePreviewEvidenceWithPath,
  requireCurrentVoiceCatalog,
} from "./voiceCatalogStore.js";

export async function readVoiceSelection(runId: string): Promise<VoiceSelection> {
  return (await readVoiceSelectionWithPath(runId)).selection;
}

export async function readVoiceSelectionWithPath(
  runId: string,
): Promise<{ path: string; selection: VoiceSelection }> {
  const run = await loadRun(runId);
  const path = latestRegisteredArtifactPath(run, isVoiceSelectionArtifactPath);
  if (!path) {
    throw new SafeExitError("No current voice selection is registered in run state.");
  }
  const selection = voiceSelectionSchema.parse(
    JSON.parse(await readFile(artifactPath(runId, path), "utf8")) as unknown,
  );
  if (selection.runId !== runId) {
    throw new SafeExitError("Voice selection belongs to a different run.");
  }
  const { selectionDigest, ...digestInput } = selection;
  if (canonicalVoiceEvidenceDigest(digestInput) !== selectionDigest) {
    throw new SafeExitError("Voice selection digest does not match its persisted content.");
  }
  const rightsRequired = selection.subscription.productionUseStatus === "operator-rights-required";
  if (
    selection.productionRights.required !== rightsRequired ||
    selection.productionRights.confirmed !== rightsRequired
  ) {
    throw new SafeExitError("Voice selection production-rights evidence is inconsistent.");
  }
  return { path, selection };
}

export async function readCurrentVoiceSelection(
  runId: string,
  options: { config?: ProducerConfig } = {},
): Promise<{
  catalogPath: string;
  previewPath: string;
  selectionPath: string;
  catalog: VoiceCandidates;
  preview: VoicePreviewEvidence;
  selection: VoiceSelection;
}> {
  const startingRun = await loadRun(runId);
  const config = options.config ?? (await loadConfig());
  const currentSelection = await readVoiceSelectionWithPath(runId);
  const selection = currentSelection.selection;
  const currentCatalog = await readVoiceCandidatesWithPath(runId);
  const catalog = currentCatalog.catalog;
  requireCurrentVoiceCatalog(catalog);
  const settings = requireElevenLabsCatalogConfig(config, catalog);
  const candidate = requireCatalogCandidate(catalog, selection.voice.voiceId);
  if (candidate.productionEligibility.status === "blocked") {
    throw new SafeExitError("Voice selection is blocked in the current catalog.");
  }
  const currentPreview = await readVoicePreviewEvidenceWithPath(runId, candidate.voiceId);
  const preview = currentPreview.evidence;
  const verifiedTurkish = candidate.verifiedLanguages.some(
    (language) =>
      language.language === settings.languageCode && language.modelId === settings.modelId,
  );
  const rightsRequired = catalog.subscription.productionUseStatus === "operator-rights-required";
  if (
    selection.catalog.path !== currentCatalog.path ||
    selection.catalog.digest !== catalog.catalogDigest ||
    selection.preview.evidencePath !== currentPreview.path ||
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
  const endingRun = await loadRun(runId);
  if (endingRun.updatedAt !== startingRun.updatedAt) {
    throw new SafeExitError("Voice evidence changed while the selection was being verified.");
  }
  return {
    catalogPath: currentCatalog.path,
    previewPath: currentPreview.path,
    selectionPath: currentSelection.path,
    catalog,
    preview,
    selection,
  };
}
