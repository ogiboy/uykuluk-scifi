import { SafeExitError } from "../core/errors.js";
import { microsToUsd, usdToMicros, usdToMicrosCeil } from "./money.js";

/** Computes a deterministic accounting estimate from configured per-character pricing. */
export function estimateElevenLabsTtsUsd(text: string, usdPerThousandCharacters: number): number {
  if (!Number.isFinite(usdPerThousandCharacters) || usdPerThousandCharacters <= 0) {
    throw new SafeExitError("ElevenLabs TTS character pricing must be a positive USD amount.");
  }
  return microsToUsd(usdToMicros((text.length / 1_000) * usdPerThousandCharacters));
}

/** Quotes per-chunk provider credits conservatively, excluding discounts from the approved cap. */
export function estimateElevenLabsMaximumTtsUsd(input: {
  chunkCharacterCounts: readonly number[];
  baseUsdPerThousandCharacters: number;
  characterCostMultiplier: number;
  costDiscountMultiplier: number;
}): number {
  const rates = [
    input.baseUsdPerThousandCharacters,
    input.characterCostMultiplier,
    input.costDiscountMultiplier,
  ];
  if (rates.some((rate) => !Number.isFinite(rate) || rate <= 0)) {
    throw new SafeExitError("ElevenLabs maximum quote rates must be positive finite amounts.");
  }
  const maximumMultiplier =
    input.characterCostMultiplier * Math.max(1, input.costDiscountMultiplier);
  const maximumBillableCredits = input.chunkCharacterCounts.reduce((total, count) => {
    if (!Number.isSafeInteger(count) || count <= 0) {
      throw new SafeExitError("ElevenLabs quote chunks require positive character counts.");
    }
    return total + Math.ceil(count * maximumMultiplier);
  }, 0);
  return microsToUsd(
    usdToMicrosCeil((maximumBillableCredits / 1_000) * input.baseUsdPerThousandCharacters),
  );
}
