import { SafeExitError } from "../core/errors.js";
import { microsToUsd, usdToMicros } from "./money.js";

/** Computes a deterministic accounting estimate from configured per-character pricing. */
export function estimateElevenLabsTtsUsd(text: string, usdPerThousandCharacters: number): number {
  if (!Number.isFinite(usdPerThousandCharacters) || usdPerThousandCharacters <= 0) {
    throw new SafeExitError("ElevenLabs TTS character pricing must be a positive USD amount.");
  }
  return microsToUsd(usdToMicros((text.length / 1_000) * usdPerThousandCharacters));
}
