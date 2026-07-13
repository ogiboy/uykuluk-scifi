import type { VoiceCandidates } from "../src/stages/voice/catalog/voiceCatalogContracts";
import { readVoiceSelectionWithPath } from "../src/stages/voice/catalog/voiceSelectionStore";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { selectVoice } from "../src/stages/voiceSelection";
import {
  configureElevenLabs,
  preparePackagedRun,
  successfulCatalogProvider,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

/**
 * Prepares a packaged run and generates its voice candidate catalog.
 *
 * @param overrides - Optional provider configuration overrides for catalog generation.
 * @returns The generated voice catalog and associated run ID.
 */
export async function prepareVoiceCatalog(
  overrides: Parameters<typeof successfulCatalogProvider>[0] = {},
) {
  await configureElevenLabs();
  const runId = await preparePackagedRun();
  const catalog = await generateVoiceCandidates(runId, {
    provider: successfulCatalogProvider(overrides),
  });
  return { catalog, runId };
}

/**
 * Extracts the voice ID from the first candidate in a voice catalog.
 *
 * @param catalog - The voice catalog containing candidate voices
 * @returns The first candidate's voice ID
 */
export function candidateVoiceId(catalog: VoiceCandidates): string {
  return catalog.candidates[0].voiceId;
}

/**
 * Prepares a paid voice-selection scenario with a production-rights confirmation.
 *
 * @returns The prepared run identifier and path to the persisted voice selection
 */
export async function preparePaidVoiceSelection() {
  const { catalog, runId } = await prepareVoiceCatalog({
    subscription: {
      tier: "creator",
      status: "active",
      characterCount: 1_000,
      characterLimit: 100_000,
      hasOpenInvoices: false,
    },
  });
  const voiceId = candidateVoiceId(catalog);
  await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
  await selectVoice(runId, {
    voiceId,
    reviewedBy: "operator",
    notes: "rights confirmed for production use",
    confirmProductionRights: true,
  });
  return { runId, selectionPath: (await readVoiceSelectionWithPath(runId)).path };
}

/**
 * Creates a promise with externally accessible resolution and rejection functions.
 *
 * @returns The controlled promise and its `resolve` and `reject` functions.
 */
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
