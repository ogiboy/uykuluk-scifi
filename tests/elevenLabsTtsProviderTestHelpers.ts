import type { ReservedProviderOutcome } from "../src/costs/reservedProviderExecution";
import {
  ElevenLabsTtsProvider,
  type ElevenLabsTtsProviderConfig,
} from "../src/stages/voice/providers/elevenLabsTtsProvider";
import type { TtsSynthesisResult } from "../src/stages/voice/providers/ttsProvider";
import { wavFromPcm16 } from "../src/stages/voice/voiceWav";

export const baseElevenLabsTtsConfig: ElevenLabsTtsProviderConfig = {
  bindingDigest: "d".repeat(64),
  voiceId: "voice_test",
  modelId: "eleven_v3",
  languageCode: "tr",
  applyTextNormalization: "auto",
  seed: 42,
  maxCharactersPerRequest: 4_500,
  outputFormat: "wav_24000",
  timeoutMs: 30_000,
  maxRetries: 0,
  maximumUsdPerThousandCharacters: 0.1,
  billedCreditUsdPerThousandCharacters: 0.1,
};

/**
 * Executes a reserved ElevenLabs text-to-speech operation for test data.
 *
 * @param text - The text to synthesize.
 * @param maxUsdMicros - The maximum permitted cost in microdollars.
 * @returns The reserved provider outcome containing the synthesis result.
 */
export async function executeElevenLabsAdapter(
  provider: ElevenLabsTtsProvider,
  text: string,
  maxUsdMicros: number,
): Promise<ReservedProviderOutcome<TtsSynthesisResult>> {
  return provider
    .createReservedAdapter({ runId: "run_test", text })
    .execute({
      reservationId: "reservation_test",
      operationId: "operation_test",
      provider: "elevenlabs",
      model: baseElevenLabsTtsConfig.modelId,
      bindingDigest: baseElevenLabsTtsConfig.bindingDigest,
      maxUsdMicros,
      signal: new AbortController().signal,
    });
}

/**
 * Creates a WAV fixture containing a 220 Hz mono sine wave.
 *
 * @returns A 24 kHz mono WAV buffer with 16-bit PCM audio
 */
export function fixtureWav(): Buffer {
  const pcm = Buffer.alloc(24_000 * 2);
  for (let index = 0; index < 24_000; index += 1) {
    pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * index) / 24_000) * 2_000), index * 2);
  }
  return wavFromPcm16(pcm, 24_000, 1);
}
