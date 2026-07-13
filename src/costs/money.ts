import { SafeExitError } from "../core/errors.js";

const USD_MICROS = 1_000_000;

/**
 * Converts a USD amount to integer micro-units.
 *
 * Rounds the USD value to the nearest micro-unit (1 USD = 1,000,000 micro-units).
 *
 * @returns The amount in integer micro-units
 * @throws SafeExitError if the input is not a finite non-negative number or if the result exceeds the safe integer range
 */
export function usdToMicros(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new SafeExitError(`Invalid USD amount: ${usd}.`);
  }
  const micros = Math.round(usd * USD_MICROS);
  if (!Number.isSafeInteger(micros)) {
    throw new SafeExitError(`USD amount is outside the supported range: ${usd}.`);
  }
  return micros;
}

/**
 * Converts a non-negative USD cap to integer micro-units, rounding fractional micro-units upward.
 *
 * @param usd - The USD amount to convert
 * @returns The amount in micro-units
 * @throws SafeExitError If `usd` is invalid or the result is outside the safe integer range
 */
export function usdToMicrosCeil(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new SafeExitError(`Invalid USD amount: ${usd}.`);
  }
  const scaled = usd * USD_MICROS;
  const floatingPointNoise = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  const micros = Math.ceil(scaled - floatingPointNoise);
  if (!Number.isSafeInteger(micros)) {
    throw new SafeExitError(`USD amount is outside the supported range: ${usd}.`);
  }
  return micros;
}

/**
 * Converts a USD amount from micros to dollars.
 *
 * @param micros - The USD amount in micro-units (1 USD equals 1,000,000 micros)
 * @throws `SafeExitError` if `micros` is not a safe integer or is negative.
 * @returns The equivalent USD amount.
 */
export function microsToUsd(micros: number): number {
  if (!Number.isSafeInteger(micros) || micros < 0) {
    throw new SafeExitError(`Invalid USD micros amount: ${micros}.`);
  }
  return micros / USD_MICROS;
}
