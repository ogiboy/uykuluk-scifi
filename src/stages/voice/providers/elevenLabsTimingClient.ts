import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { ElevenLabsTimingClient, ElevenLabsTimingResponse } from "./elevenLabsTtsContracts.js";

/**
 * Creates an ElevenLabs timing client configured with the provided API key.
 *
 * @param apiKey - The API key used to authenticate ElevenLabs requests
 * @returns A client that converts text to speech with timestamp metadata
 */
export function createOfficialElevenLabsTimingClient(apiKey: string): ElevenLabsTimingClient {
  const client = new ElevenLabsClient({ apiKey });
  return {
    async convertWithTimestamps(input): Promise<ElevenLabsTimingResponse> {
      const { data, rawResponse } = await client.textToSpeech
        .convertWithTimestamps(
          input.voiceId,
          {
            text: input.text,
            modelId: input.modelId,
            languageCode: input.modelId === "eleven_v3" ? input.languageCode : undefined,
            applyTextNormalization: input.applyTextNormalization,
            seed: input.seed,
            previousRequestIds: input.previousRequestIds,
            previousText: input.previousText,
            nextText: input.nextText,
            outputFormat: input.outputFormat,
            voiceSettings: input.voiceSettings,
          },
          {
            abortSignal: input.signal,
            timeoutInSeconds: input.timeoutMs / 1_000,
            maxRetries: input.maxRetries,
          },
        )
        .withRawResponse();
      return {
        ...data,
        characterCost: parseCharacterCost(rawResponse.headers.get("character-cost")),
        requestId: rawResponse.headers.get("request-id") ?? undefined,
      };
    },
  };
}

/**
 * Parses a character-cost header value.
 *
 * @param value - The header value to parse.
 * @returns The non-negative character cost, or `undefined` for an invalid or missing value.
 */
function parseCharacterCost(value: string | null): number | undefined {
  if (value === null || !/^\d+(?:\.\d{1,6})?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
