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

export function candidateVoiceId(catalog: VoiceCandidates): string {
  return catalog.candidates[0].voiceId;
}

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

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
