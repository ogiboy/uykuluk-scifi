import { SafeExitError } from "../../../core/errors.js";

/**
 * Normalizes, sorts, and limits label entries.
 *
 * @param labels - The label key-value pairs to normalize.
 * @returns Up to 12 entries with trimmed, bounded, and valid keys and values, sorted by key.
 */
export function normalizeLabels(labels: Record<string, string> | undefined) {
  return Object.entries(labels ?? {})
    .map(([key, value]) => ({ key: boundedOptional(key, 64), value: boundedOptional(value, 120) }))
    .filter((entry): entry is { key: string; value: string } => Boolean(entry.key && entry.value))
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(0, 12);
}

/**
 * Normalizes a list of strings and limits the number of results.
 *
 * @param values - The strings to normalize.
 * @param limit - The maximum number of strings to return.
 * @param maxLength - The maximum length of each string.
 * @returns Unique, trimmed, sorted, and bounded strings.
 */
export function boundedList(
  values: string[] | undefined,
  limit: number,
  maxLength: number,
): string[] {
  const normalizedValues = Array.from(
    new Set(
      (values ?? [])
        .map((value) => boundedOptional(value, maxLength))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  normalizedValues.sort((left, right) => left.localeCompare(right));
  return normalizedValues.slice(0, limit);
}

/**
 * Normalizes a required string and rejects missing or invalid values.
 *
 * @param value - The string to normalize
 * @param maxLength - The maximum allowed length
 * @param label - The field name included in the validation error
 * @returns The trimmed and truncated string
 */
export function boundedRequired(value: string, maxLength: number, label: string): string {
  const normalized = boundedOptional(value, maxLength);
  if (!normalized) {
    throw new SafeExitError(`ElevenLabs ${label} is missing or invalid.`);
  }
  return normalized;
}

/**
 * Trims and length-limits an optional string while rejecting empty values and unsafe control characters.
 *
 * @param value - The string to normalize.
 * @param maxLength - The maximum number of characters to retain.
 * @returns The normalized string, or `undefined` when the input is empty or contains unsafe control characters.
 */
export function boundedOptional(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim();
  return normalized && !hasUnsafeControlCharacters(normalized)
    ? normalized.slice(0, maxLength)
    : undefined;
}

/**
 * Determines whether a string contains unsafe control characters.
 *
 * @param value - The string to inspect.
 * @returns `true` if the string contains an unsafe control character, `false` otherwise.
 */
export function hasUnsafeControlCharacters(value: string | undefined): boolean {
  if (!value) return false;
  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.codePointAt(index);
    if (characterCode !== undefined && isControlCharacterCode(characterCode)) return true;
  }
  return false;
}

/**
 * Determines whether a value contains unsafe control characters outside allowed notes whitespace.
 *
 * @param value - The value to inspect
 * @returns `true` if the value contains an unsafe control character, `false` otherwise.
 */
export function hasUnsafeNotesControlCharacters(value: string | undefined): boolean {
  if (!value) return false;
  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.codePointAt(index);
    if (
      characterCode !== undefined &&
      isControlCharacterCode(characterCode) &&
      !isNotesWhitespaceCode(characterCode)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Determines whether a character code represents an unsafe control character.
 *
 * @param characterCode - The character code to evaluate
 * @returns `true` if the character code is an unsafe control character, `false` otherwise.
 */
function isControlCharacterCode(characterCode: number): boolean {
  return characterCode <= 0x1f || (characterCode >= 0x7f && characterCode <= 0x9f);
}

/**
 * Determines whether a character code represents allowed whitespace in notes.
 *
 * @param characterCode - The character code to evaluate
 * @returns `true` for tab, line feed, or carriage return character codes, `false` otherwise
 */
function isNotesWhitespaceCode(characterCode: number): boolean {
  return characterCode === 0x09 || characterCode === 0x0a || characterCode === 0x0d;
}

/**
 * Validates a rate value within the supported range.
 *
 * @param label - The name used in the validation error message
 * @returns The validated rate between 0 and 100
 */
export function requirePositiveRate(value: number | undefined, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100) {
    throw new SafeExitError(`ElevenLabs ${label} is missing or unsafe.`);
  }
  return value;
}

/**
 * Validates a positive integer within the supported maximum range.
 *
 * @param value - The value to validate.
 * @param label - The field label used in the error message.
 * @returns The validated value.
 */
export function requirePositiveInteger(value: number | undefined, label: string): number {
  if (!positiveInteger(value) || value > 100_000) {
    throw new SafeExitError(`ElevenLabs ${label} is missing or unsafe.`);
  }
  return value;
}

/**
 * Determines whether a value is a positive integer.
 *
 * @param value - The value to check
 * @returns `true` if `value` is an integer greater than zero, `false` otherwise.
 */
export function positiveInteger(value: number | undefined): value is number {
  return Number.isInteger(value) && (value ?? 0) > 0;
}

/**
 * Validates a nonnegative integer value.
 *
 * @param value - The value to validate
 * @param label - The name used in the validation error message
 * @returns The validated value
 * @throws SafeExitError If `value` is not an integer greater than or equal to zero
 */
export function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new SafeExitError(`ElevenLabs ${label} is invalid.`);
  }
  return value;
}

/**
 * Determines whether a value is a nonnegative integer.
 *
 * @param value - The value to validate
 * @returns `true` if the value is an integer greater than or equal to zero, `false` otherwise
 */
export function nonnegativeIntegerValue(value: number | undefined): value is number {
  return Number.isInteger(value) && (value ?? -1) >= 0;
}

/**
 * Determines whether a value is a finite number greater than or equal to zero.
 *
 * @param value - The value to validate
 * @returns `true` if the value is a finite number greater than or equal to zero, `false` otherwise
 */
export function nonnegativeNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
