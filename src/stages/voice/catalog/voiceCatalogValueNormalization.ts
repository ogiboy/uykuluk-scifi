import { SafeExitError } from "../../../core/errors.js";

export function normalizeLabels(labels: Record<string, string> | undefined) {
  return Object.entries(labels ?? {})
    .map(([key, value]) => ({ key: boundedOptional(key, 64), value: boundedOptional(value, 120) }))
    .filter((entry): entry is { key: string; value: string } => Boolean(entry.key && entry.value))
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(0, 12);
}

export function boundedList(
  values: string[] | undefined,
  limit: number,
  maxLength: number,
): string[] {
  return Array.from(
    new Set((values ?? []).map((value) => boundedOptional(value, maxLength)).filter(Boolean)),
  )
    .sort()
    .slice(0, limit) as string[];
}

export function boundedRequired(value: string, maxLength: number, label: string): string {
  const normalized = boundedOptional(value, maxLength);
  if (!normalized) {
    throw new SafeExitError(`ElevenLabs ${label} is missing or invalid.`);
  }
  return normalized;
}

export function boundedOptional(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

export function requirePositiveRate(value: number | undefined, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100) {
    throw new SafeExitError(`ElevenLabs ${label} is missing or unsafe.`);
  }
  return value;
}

export function requirePositiveInteger(value: number | undefined, label: string): number {
  if (!positiveInteger(value) || value > 100_000) {
    throw new SafeExitError(`ElevenLabs ${label} is missing or unsafe.`);
  }
  return value;
}

export function positiveInteger(value: number | undefined): value is number {
  return Number.isInteger(value) && (value ?? 0) > 0;
}

export function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new SafeExitError(`ElevenLabs ${label} is invalid.`);
  }
  return value;
}

export function nonnegativeIntegerValue(value: number | undefined): value is number {
  return Number.isInteger(value) && (value ?? -1) >= 0;
}

export function nonnegativeNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
