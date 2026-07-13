import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type {
  CatalogModel,
  CatalogSubscription,
  CatalogVoice,
  ElevenLabsCatalogClient,
} from "../catalog/voiceCatalogProvider.js";

const requestTimeoutSeconds = 30;
// SDK retry sleeps are not abort-aware; V1 keeps retries at zero under the outer deadline.
const maximumRetries = 0;

/**
 * Creates a narrowly scoped, read-only ElevenLabs client for catalog and preview operations.
 *
 * @param apiKey - The API key used to authenticate requests.
 * @returns A client that provides read-only catalog and preview operations.
 */
export function createOfficialElevenLabsCatalogClient(apiKey: string): ElevenLabsCatalogClient {
  const client = new ElevenLabsClient({
    apiKey,
    maxRetries: maximumRetries,
    timeoutInSeconds: requestTimeoutSeconds,
  });
  const options = { maxRetries: maximumRetries, timeoutInSeconds: requestTimeoutSeconds };
  return {
    async searchVoices(request) {
      const { data, rawResponse } = await client.voices
        .search(
          {
            nextPageToken: request.nextPageToken,
            pageSize: request.pageSize,
            includeTotalCount: false,
          },
          { ...options, abortSignal: request.abortSignal },
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
    async listModels(request) {
      const { data, rawResponse } = await client.models
        .list({ ...options, abortSignal: request?.abortSignal })
        .withRawResponse();
      return {
        data: data as CatalogModel[],
        requestId: rawResponse.headers.get("request-id") ?? undefined,
      };
    },
    async getSubscription(request) {
      const { data, rawResponse } = await client.user.subscription
        .get({ ...options, abortSignal: request?.abortSignal })
        .withRawResponse();
      return {
        data: data as CatalogSubscription,
        requestId: rawResponse.headers.get("request-id") ?? undefined,
      };
    },
    async getVoice(voiceId, request) {
      const { data, rawResponse } = await client.voices
        .get(voiceId, { withSettings: false }, { ...options, abortSignal: request?.abortSignal })
        .withRawResponse();
      return {
        data: data as CatalogVoice,
        requestId: rawResponse.headers.get("request-id") ?? undefined,
      };
    },
  };
}
