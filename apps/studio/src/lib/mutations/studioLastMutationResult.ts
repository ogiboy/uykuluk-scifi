import { z } from "zod";

export type StudioLastMutationResultKind = "blocked" | "error" | "success";

export type StudioLastMutationResult = Readonly<{
  actionId: string;
  facts: readonly string[];
  kind: StudioLastMutationResultKind;
  message: string;
  recordedAtIso: string;
  refreshedPersistedState: boolean;
  routePath: string;
  runId: string | null;
  status?: number;
}>;

export const studioLastMutationResultEventName = "uykuluk:studio-last-mutation-result";

const storageKey = "uykuluk:studio:last-mutation-result:v1";
const maxFactCount = 8;
const maxTextLength = 240;
const boundedRequiredStringSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.slice(0, maxTextLength));
const boundedOptionalStringSchema = z
  .union([z.string(), z.null()])
  .transform((value) => boundedString(value));
const studioLastMutationResultSchema = z.strictObject({
  actionId: boundedRequiredStringSchema,
  facts: z.array(z.unknown()).transform((facts) =>
    facts
      .map((fact) => boundedString(fact))
      .filter(isString)
      .slice(0, maxFactCount),
  ),
  kind: z.enum(["blocked", "error", "success"]),
  message: boundedRequiredStringSchema,
  recordedAtIso: z.iso.datetime(),
  refreshedPersistedState: z.boolean(),
  routePath: boundedRequiredStringSchema,
  runId: boundedOptionalStringSchema,
  status: z.int().min(100).max(599).optional(),
});

/**
 * Reads the latest same-tab Studio mutation result from session storage.
 *
 * @returns The bounded UI notice payload, or `null` when unavailable or invalid.
 */
export function readStudioLastMutationResult(): StudioLastMutationResult | null {
  const snapshot = readStudioLastMutationResultSnapshot();
  if (!snapshot) {
    return null;
  }
  try {
    return parseStudioLastMutationResult(JSON.parse(snapshot));
  } catch {
    return null;
  }
}

/**
 * Reads the raw latest mutation snapshot for React external-store subscriptions.
 *
 * @returns The stored JSON payload, or an empty string when unavailable.
 */
export function readStudioLastMutationResultSnapshot(): string {
  const storage = safeSessionStorage();
  if (!storage) {
    return "";
  }
  try {
    return storage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

/**
 * Persists the latest Studio mutation result for the current browser session only.
 *
 * @param result - Bounded operator-facing result copy from a guarded Studio action.
 */
export function writeStudioLastMutationResult(result: StudioLastMutationResult): void {
  const storage = safeSessionStorage();
  if (!storage) {
    return;
  }
  const normalized = studioLastMutationResultSchema.safeParse(result);
  if (!normalized.success) {
    return;
  }
  try {
    storage.setItem(storageKey, JSON.stringify(normalized.data));
    dispatchStudioLastMutationResult(normalized.data);
  } catch {
    // UI notice persistence must never break the guarded action path.
  }
}

/**
 * Clears the latest same-tab Studio mutation result.
 */
export function clearStudioLastMutationResult(): void {
  const storage = safeSessionStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(storageKey);
    dispatchStudioLastMutationResult(null);
  } catch {
    // Best-effort UI cleanup only.
  }
}

export function parseStudioLastMutationResult(value: unknown): StudioLastMutationResult | null {
  const parsed = studioLastMutationResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function dispatchStudioLastMutationResult(result: StudioLastMutationResult | null): void {
  const target = globalThis.window;
  if (!target) {
    return;
  }
  target.dispatchEvent(new CustomEvent(studioLastMutationResultEventName, { detail: result }));
}

function safeSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function boundedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxTextLength) : null;
}

function isString(value: string | null): value is string {
  return value !== null;
}
