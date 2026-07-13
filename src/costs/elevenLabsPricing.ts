import { SafeExitError } from "../core/errors.js";
import { microsToUsd, usdToMicros, usdToMicrosCeil } from "./money.js";

/**
 * Estimates the USD cost of synthesizing text with ElevenLabs TTS.
 *
 * @param text - The text whose characters determine the estimated cost
 * @param usdPerThousandCharacters - The configured USD price per 1,000 characters
 * @returns The estimated cost in USD
 * @throws SafeExitError If the configured price is not a positive finite number
 */
export function estimateElevenLabsTtsUsd(text: string, usdPerThousandCharacters: number): number {
  if (!Number.isFinite(usdPerThousandCharacters) || usdPerThousandCharacters <= 0) {
    throw new SafeExitError("ElevenLabs TTS character pricing must be a positive USD amount.");
  }
  return microsToUsd(usdToMicros((text.length / 1_000) * usdPerThousandCharacters));
}

/**
 * Computes a conservative USD maximum for ElevenLabs text-to-speech chunks.
 *
 * @param input - Pricing rates and positive character counts for each chunk
 * @returns The conservatively rounded maximum USD estimate, excluding discounts from the approved cap
 */
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
