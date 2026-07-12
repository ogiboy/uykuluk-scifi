import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { ElevenLabsTimingClient, ElevenLabsTimingResponse } from "./elevenLabsTtsContracts.js";

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

function parseCharacterCost(value: string | null): number | undefined {
  return value !== null && /^\d+$/.test(value) ? Number(value) : undefined;
}
