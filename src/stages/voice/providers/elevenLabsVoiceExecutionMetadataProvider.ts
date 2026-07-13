import { SafeExitError } from "../../../core/errors.js";
import { normalizeVoiceCatalog } from "../catalog/voiceCatalogNormalization.js";
import type {
  ElevenLabsCatalogClient,
  VoiceCatalogRequest,
} from "../catalog/voiceCatalogProvider.js";
import { assertVoiceCatalogRedacted } from "../catalog/voiceCatalogRedaction.js";
import type { VoiceExecutionMetadataProvider } from "../voiceExecutionPreflight.js";
import { createOfficialElevenLabsCatalogClient } from "./elevenLabsCatalogClient.js";

const defaultOperationTimeoutMs = 120_000;

type Options = {
  readApiKey?: () => string | undefined;
  createClient?: (apiKey: string) => ElevenLabsCatalogClient;
  operationTimeoutMs?: number;
};

/** Fetches only the selected voice, model list, and subscription through bounded read-only GETs. */
export class ElevenLabsVoiceExecutionMetadataProvider implements VoiceExecutionMetadataProvider {
  readonly provider = "elevenlabs" as const;

  private readonly readApiKey: () => string | undefined;
  private readonly createClient: (apiKey: string) => ElevenLabsCatalogClient;
  private readonly operationTimeoutMs: number;

  constructor(options: Options = {}) {
    this.readApiKey = options.readApiKey ?? (() => process.env.ELEVENLABS_API_KEY);
    this.createClient = options.createClient ?? createOfficialElevenLabsCatalogClient;
    this.operationTimeoutMs = Math.max(
      1,
      Math.min(options.operationTimeoutMs ?? defaultOperationTimeoutMs, 300_000),
    );
  }

  assertReady(): void {
    if (!this.readApiKey()?.trim()) {
      throw new SafeExitError(
        "ElevenLabs execution preflight requires ELEVENLABS_API_KEY in the server environment.",
      );
    }
  }

  async fetchSnapshot(input: VoiceCatalogRequest & { voiceId: string }) {
    this.assertReady();
    const apiKey = this.readApiKey()?.trim();
    if (!apiKey) {
      throw new SafeExitError("ElevenLabs execution preflight credential is unavailable.");
    }
    const requestIds: string[] = [];
    try {
      return await withDeadline(this.operationTimeoutMs, async (abortSignal) => {
        const client = this.createClient(apiKey);
        const [models, subscription, voice] = await Promise.all([
          client.listModels({ abortSignal }),
          client.getSubscription({ abortSignal }),
          client.getVoice(input.voiceId, { abortSignal }),
        ]);
        collectRequestId(requestIds, models.requestId);
        collectRequestId(requestIds, subscription.requestId);
        collectRequestId(requestIds, voice.requestId);
        const catalog = normalizeVoiceCatalog({
          request: input,
          voices: [voice.data],
          models: models.data,
          subscription: subscription.data,
          requestIds,
        });
        assertVoiceCatalogRedacted({ apiKey, catalog, requestIds, voices: [voice.data] });
        return catalog;
      });
    } catch (error) {
      if (error instanceof SafeExitError) throw error;
      throw new SafeExitError("ElevenLabs execution metadata refresh failed safely.");
    }
  }
}

/**
 * Adds a valid upstream request identifier to a collection.
 *
 * @param target - The collection receiving the request identifier
 * @param value - The request identifier to trim and collect
 */
function collectRequestId(target: string[], value: string | undefined): void {
  const normalized = value?.trim();
  if (normalized && normalized.length <= 256) target.push(normalized);
}

/**
 * Runs a task with a bounded deadline and aborts it when the deadline expires or execution finishes.
 *
 * @param timeoutMs - The maximum duration allowed for the task in milliseconds
 * @param task - The asynchronous operation to run with an abort signal
 * @returns The task's result
 */
async function withDeadline<T>(
  timeoutMs: number,
  task: (abortSignal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      const error = new SafeExitError(
        "ElevenLabs execution metadata refresh exceeded its bounded deadline.",
      );
      reject(error);
      queueMicrotask(() => controller.abort(error));
    }, timeoutMs);
  });
  try {
    return await Promise.race([task(controller.signal), deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (!controller.signal.aborted) {
      controller.abort(
        new SafeExitError("ElevenLabs execution metadata refresh completed or failed safely."),
      );
    }
  }
}
