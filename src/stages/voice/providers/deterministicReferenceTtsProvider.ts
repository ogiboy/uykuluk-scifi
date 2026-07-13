import { createHash } from "node:crypto";
import { SafeExitError } from "../../../core/errors.js";
import { wavFromPcm16 } from "../voiceWav.js";
import type { LocalTtsProvider, TtsSynthesisResult } from "./ttsProvider.js";

const maximumReferenceDurationSeconds = 20 * 60;

/** Timing-only deterministic audio provider used by tests and local previews. */
export class DeterministicReferenceTtsProvider implements LocalTtsProvider {
  readonly mode = "deterministic-local" as const;
  readonly executionPolicy = "local" as const;

  async synthesize(input: { text: string }): Promise<TtsSynthesisResult> {
    const sampleRateHz = 16_000;
    const wordCount = countWords(input.text);
    const durationSeconds = Math.max(1, Math.ceil(wordCount / 2.4));
    if (durationSeconds > maximumReferenceDurationSeconds) {
      throw new SafeExitError(
        "Deterministic reference narration exceeds the supported 20-minute duration.",
      );
    }
    const sampleCount = sampleRateHz * durationSeconds;
    const pcm = Buffer.alloc(sampleCount * 2);
    const seed = createHash("sha256").update(input.text, "utf8").digest();
    const baseFrequency = 180 + seed[0];
    for (let index = 0; index < sampleCount; index += 1) {
      const t = index / sampleRateHz;
      const carrier = Math.sin(2 * Math.PI * baseFrequency * t);
      const pulse = Math.sin(2 * Math.PI * (baseFrequency / 3) * t) > 0 ? 1 : 0.25;
      pcm.writeInt16LE(Math.round(carrier * pulse * 2_800), index * 2);
    }
    return {
      buffer: wavFromPcm16(pcm, sampleRateHz, 1),
      channels: 1,
      durationSeconds,
      outputAlreadyPersisted: false,
      quality: "deterministic-local-reference",
      sampleRateHz,
    };
  }
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
