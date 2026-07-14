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
import { requireCatalogCandidate } from "./voiceCatalogGuards.js";
import {
  readVoiceCandidatesWithPath,
  readVoicePreviewEvidenceWithPath,
  requireCurrentVoiceCatalog,
} from "./voiceCatalogStore.js";
import { assertVoiceSelectionMatchesEvidence } from "./voiceSelectionIntegrity.js";

/**
 * Reads the persisted voice selection for a run.
 *
 * @param runId - The identifier of the run whose voice selection to read
 * @returns The validated voice selection
 */
export async function readVoiceSelection(runId: string): Promise<VoiceSelection> {
  return (await readVoiceSelectionWithPath(runId)).selection;
}

/**
 * Loads and validates the latest registered voice selection for a run.
 *
 * @param runId - The identifier of the run containing the voice selection
 * @returns The artifact path and validated voice selection
 * @throws SafeExitError If no selection is registered or the selection is inconsistent or invalid
 */
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

/**
 * Verifies the persisted voice selection against the current catalog and preview evidence.
 *
 * @param runId - The identifier of the run whose voice selection should be verified
 * @param options - Optional producer configuration override
 * @returns The verified catalog, preview evidence, selection, and their artifact paths
 */
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
  const candidate = requireCatalogCandidate(catalog, selection.voice.voiceId);
  if (candidate.productionEligibility.status === "blocked") {
    throw new SafeExitError("Voice selection is blocked in the current catalog.");
  }
  const currentPreview = await readVoicePreviewEvidenceWithPath(runId, candidate.voiceId);
  const preview = currentPreview.evidence;
  assertVoiceSelectionMatchesEvidence({
    catalogPath: currentCatalog.path,
    previewPath: currentPreview.path,
    catalog,
    preview,
    selection,
    config,
  });
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
