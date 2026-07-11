/**
 * Parses a Sentry sample-rate environment value into a safe disabled-by-default range.
 *
 * @param value - Optional environment value.
 * @returns A number from zero through one, or zero for invalid input.
 */
export function sentrySampleRate(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
}
