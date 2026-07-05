export type StudioLastMutationResultKind = "blocked" | "error" | "success";

export type StudioLastMutationResult = Readonly<{
  actionId: string;
  facts: readonly string[];
  kind: StudioLastMutationResultKind;
  message: string;
  recordedAtIso: string;
  refreshedPersistedState: boolean;
  routePath: string;
  status?: number;
}>;

export const studioLastMutationResultEventName = "uykuluk:studio-last-mutation-result";

const storageKey = "uykuluk:studio:last-mutation-result:v1";
const maxFactCount = 8;
const maxTextLength = 240;

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
  const normalized = normalizeStudioLastMutationResult(result);
  try {
    storage.setItem(storageKey, JSON.stringify(normalized));
    dispatchStudioLastMutationResult(normalized);
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
  if (!isRecord(value)) {
    return null;
  }
  const kind = mutationKind(value.kind);
  const actionId = boundedString(value.actionId);
  const routePath = boundedString(value.routePath);
  const message = boundedString(value.message);
  const recordedAtIso = boundedString(value.recordedAtIso);
  if (!kind || !actionId || !routePath || !message || !recordedAtIso) {
    return null;
  }
  return normalizeStudioLastMutationResult({
    actionId,
    facts: Array.isArray(value.facts) ? value.facts.filter(isString) : [],
    kind,
    message,
    recordedAtIso,
    refreshedPersistedState: value.refreshedPersistedState === true,
    routePath,
    status: finiteStatus(value.status),
  });
}

function normalizeStudioLastMutationResult(
  result: StudioLastMutationResult,
): StudioLastMutationResult {
  return {
    actionId: boundedString(result.actionId) ?? "unknown",
    facts: result.facts
      .map((fact) => boundedString(fact))
      .filter(isString)
      .slice(0, maxFactCount),
    kind: result.kind,
    message: boundedString(result.message) ?? "Studio action finished.",
    recordedAtIso: boundedString(result.recordedAtIso) ?? new Date().toISOString(),
    refreshedPersistedState: result.refreshedPersistedState,
    routePath: boundedString(result.routePath) ?? "unknown",
    status: finiteStatus(result.status),
  };
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

function mutationKind(value: unknown): StudioLastMutationResultKind | null {
  return value === "blocked" || value === "error" || value === "success" ? value : null;
}

function finiteStatus(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

function boundedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxTextLength) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: string | null): value is string {
  return value !== null;
}
