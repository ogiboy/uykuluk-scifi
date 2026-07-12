import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { SafeExitError } from "../../../core/errors.js";
import type { VoiceCatalogProviderResult } from "../catalog/voiceCatalogContracts.js";
import { normalizeVoiceCatalog } from "../catalog/voiceCatalogNormalization.js";
import type {
  CatalogModel,
  CatalogSubscription,
  CatalogVoice,
  ElevenLabsCatalogClient,
  VoiceCatalogProvider,
  VoiceCatalogRequest,
} from "../catalog/voiceCatalogProvider.js";

const catalogPageSize = 100;
const maximumCatalogPages = 5;
const catalogTimeoutSeconds = 30;
const catalogMaxRetries = 2;

type ElevenLabsVoiceCatalogProviderOptions = {
  readApiKey?: () => string | undefined;
  createClient?: (apiKey: string) => ElevenLabsCatalogClient;
};

/** Read-only ElevenLabs voice/model/subscription catalog adapter. */
export class ElevenLabsVoiceCatalogProvider implements VoiceCatalogProvider {
  readonly provider = "elevenlabs" as const;

  private readonly readApiKey: () => string | undefined;
  private readonly createClient: (apiKey: string) => ElevenLabsCatalogClient;

  constructor(options: ElevenLabsVoiceCatalogProviderOptions = {}) {
    this.readApiKey = options.readApiKey ?? (() => process.env.ELEVENLABS_API_KEY);
    this.createClient = options.createClient ?? createOfficialClient;
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
    try {
      const client = this.createClient(apiKey);
      const requestIds: string[] = [];
      const models = await client.listModels();
      pushRequestId(requestIds, models.requestId);
      const subscription = await client.getSubscription();
      pushRequestId(requestIds, subscription.requestId);
      const voices = await readVoicePages(client, requestIds);
      return normalizeVoiceCatalog({
        request: input,
        voices,
        models: models.data,
        subscription: subscription.data,
        requestIds,
      });
    } catch (error) {
      if (error instanceof SafeExitError) {
        throw error;
      }
      throw new SafeExitError("ElevenLabs voice catalog request failed safely.");
    }
  }
}

async function readVoicePages(
  client: ElevenLabsCatalogClient,
  requestIds: string[],
): Promise<CatalogVoice[]> {
  const voices: CatalogVoice[] = [];
  const seenTokens = new Set<string>();
  let nextPageToken: string | undefined;
  for (let page = 0; page < maximumCatalogPages; page += 1) {
    const response = await client.searchVoices({ nextPageToken, pageSize: catalogPageSize });
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

function createOfficialClient(apiKey: string): ElevenLabsCatalogClient {
  const client = new ElevenLabsClient({
    apiKey,
    maxRetries: catalogMaxRetries,
    timeoutInSeconds: catalogTimeoutSeconds,
  });
  const requestOptions = { maxRetries: catalogMaxRetries, timeoutInSeconds: catalogTimeoutSeconds };
  return {
    async searchVoices(request) {
      const { data, rawResponse } = await client.voices
        .search(
          {
            nextPageToken: request.nextPageToken,
            pageSize: request.pageSize,
            includeTotalCount: false,
          },
          requestOptions,
        )
        .withRawResponse();
      return {
        data: {
          voices: data.voices as CatalogVoice[],
          hasMore: data.hasMore,
          nextPageToken: data.nextPageToken,
        },
        requestId: rawResponse.headers.get("request-id") ?? undefined,
      };
    },
    async listModels() {
      const { data, rawResponse } = await client.models.list(requestOptions).withRawResponse();
      return {
        data: data as CatalogModel[],
        requestId: rawResponse.headers.get("request-id") ?? undefined,
      };
    },
    async getSubscription() {
      const { data, rawResponse } = await client.user.subscription
        .get(requestOptions)
        .withRawResponse();
      return {
        data: data as CatalogSubscription,
        requestId: rawResponse.headers.get("request-id") ?? undefined,
      };
    },
  };
}
