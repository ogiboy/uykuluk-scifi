import { SafeExitError } from "../core/errors";

const USD_MICROS = 1_000_000;

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

export function microsToUsd(micros: number): number {
  if (!Number.isSafeInteger(micros) || micros < 0) {
    throw new SafeExitError(`Invalid USD micros amount: ${micros}.`);
  }
  return micros / USD_MICROS;
}
