import { ElevenLabsError, ElevenLabsTimeoutError } from "@elevenlabs/elevenlabs-js";
import { SafeExitError } from "../../../core/errors.js";
import { sha256 } from "../../../utils/hash.js";
import type { VoiceCatalogProviderResult } from "../catalog/voiceCatalogContracts.js";
import { normalizeVoiceCatalog } from "../catalog/voiceCatalogNormalization.js";
import type {
  CatalogVoice,
  ElevenLabsCatalogClient,
  VoiceCatalogProvider,
  VoiceCatalogRequest,
} from "../catalog/voiceCatalogProvider.js";
import { VoiceCatalogProviderError } from "../catalog/voiceCatalogProvider.js";
import { assertVoiceCatalogRedacted } from "../catalog/voiceCatalogRedaction.js";
import { createOfficialElevenLabsCatalogClient } from "./elevenLabsCatalogClient.js";

const catalogPageSize = 100;
const maximumCatalogPages = 5;
const catalogOperationTimeoutMs = 120_000;

type ElevenLabsVoiceCatalogProviderOptions = {
  readApiKey?: () => string | undefined;
  createClient?: (apiKey: string) => ElevenLabsCatalogClient;
  operationTimeoutMs?: number;
};

/** Read-only ElevenLabs voice/model/subscription catalog adapter. */
export class ElevenLabsVoiceCatalogProvider implements VoiceCatalogProvider {
  readonly provider = "elevenlabs" as const;

  private readonly readApiKey: () => string | undefined;
  private readonly createClient: (apiKey: string) => ElevenLabsCatalogClient;
  private readonly operationTimeoutMs: number;

  constructor(options: ElevenLabsVoiceCatalogProviderOptions = {}) {
    this.readApiKey = options.readApiKey ?? (() => process.env.ELEVENLABS_API_KEY);
    this.createClient = options.createClient ?? createOfficialElevenLabsCatalogClient;
    this.operationTimeoutMs = Math.max(
      1,
      Math.min(options.operationTimeoutMs ?? catalogOperationTimeoutMs, 300_000),
    );
  }

  assertReady(): void {
    if (!this.readApiKey()?.trim()) {
      throw new SafeExitError(
        "ElevenLabs voice catalog requires ELEVENLABS_API_KEY in the server environment.",
      );
    }
  }

  async fetchCatalog(input: VoiceCatalogRequest): Promise<VoiceCatalogProviderResult> {
    this.assertReady();
    const apiKey = this.readApiKey()?.trim();
    if (!apiKey) {
      throw new SafeExitError("ElevenLabs voice catalog credential is unavailable.");
    }
    const requestIds: string[] = [];
    try {
      return await withCatalogDeadline(this.operationTimeoutMs, async (abortSignal) => {
        const client = this.createClient(apiKey);
        const models = await client.listModels({ abortSignal });
        pushRequestId(requestIds, models.requestId);
        const subscription = await client.getSubscription({ abortSignal });
        pushRequestId(requestIds, subscription.requestId);
        const voices = await readVoicePages(client, requestIds, abortSignal);
        const catalog = normalizeVoiceCatalog({
          request: input,
          voices,
          models: models.data,
          subscription: subscription.data,
          requestIds,
        });
        assertVoiceCatalogRedacted({ apiKey, catalog, requestIds, voices });
        return catalog;
      });
    } catch (error) {
      throw catalogProviderError(error, requestIds);
    }
  }
}

async function readVoicePages(
  client: ElevenLabsCatalogClient,
  requestIds: string[],
  abortSignal?: AbortSignal,
): Promise<CatalogVoice[]> {
  const voices: CatalogVoice[] = [];
  const seenTokens = new Set<string>();
  let nextPageToken: string | undefined;
  for (let page = 0; page < maximumCatalogPages; page += 1) {
    const response = await client.searchVoices({
      abortSignal,
      nextPageToken,
      pageSize: catalogPageSize,
    });
    pushRequestId(requestIds, response.requestId);
    voices.push(...response.data.voices);
    if (!response.data.hasMore) {
      return voices;
    }
    const next = response.data.nextPageToken?.trim();
    if (!next || seenTokens.has(next)) {
      throw new SafeExitError("ElevenLabs voice catalog pagination metadata is invalid.");
    }
    seenTokens.add(next);
    nextPageToken = next;
  }
  throw new SafeExitError("ElevenLabs voice catalog exceeded the bounded pagination limit.");
}

function pushRequestId(target: string[], value: string | undefined): void {
  const normalized = value?.trim();
  if (normalized && normalized.length <= 256) {
    target.push(normalized);
  }
}

function catalogProviderError(error: unknown, requestIds: string[]): VoiceCatalogProviderError {
  const requestIdHashes = requestIds.map((requestId) => sha256(requestId));
  if (error instanceof VoiceCatalogProviderError) {
    if (error.requestIdHashes.length > 0 || requestIdHashes.length === 0) return error;
    return new VoiceCatalogProviderError(error.message, error.providerCode, requestIdHashes);
  }
  if (error instanceof SafeExitError) {
    return new VoiceCatalogProviderError(
      error.message,
      "provider-response-invalid",
      requestIdHashes,
    );
  }
  if (error instanceof ElevenLabsError) {
    const statusCode = error.statusCode ?? error.rawResponse?.status;
    const code = providerCodeForStatus(statusCode);
    return new VoiceCatalogProviderError(
      "ElevenLabs voice catalog request failed safely.",
      code,
      requestIdHashes,
    );
  }
  return new VoiceCatalogProviderError(
    error instanceof ElevenLabsTimeoutError
      ? "ElevenLabs voice catalog request timed out safely."
      : "ElevenLabs voice catalog request failed safely.",
    "provider-unavailable",
    requestIdHashes,
  );
}

function providerCodeForStatus(
  statusCode: number | undefined,
): VoiceCatalogProviderError["providerCode"] {
  if (statusCode === 401 || statusCode === 403) return "configuration";
  if ([400, 404, 409, 422].includes(statusCode ?? -1)) return "provider-response-invalid";
  return "provider-unavailable";
}

async function withCatalogDeadline<T>(
  timeoutMs: number,
  task: (abortSignal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadlineError = new VoiceCatalogProviderError(
    "ElevenLabs voice catalog operation exceeded its bounded deadline.",
    "provider-unavailable",
  );
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(deadlineError);
      queueMicrotask(() => controller.abort(deadlineError));
    }, timeoutMs);
  });
  try {
    return await Promise.race([task(controller.signal), deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
