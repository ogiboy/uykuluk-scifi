import { studioActionHeaderName, studioSessionHeaderName } from "./studioMutationSecurity";

type StudioSessionResponse = Readonly<{
  expiresInSeconds?: unknown;
  token?: unknown;
}>;

export type StudioMutationSessionSnapshot = Readonly<
  | {
      expiresAtMs: number;
      expiresInSeconds: number;
      status: "ready";
    }
  | {
      status: "missing";
    }
>;

type CachedStudioMutationSession = Readonly<{
  expiresAtMs: number;
  token: string;
}>;

const sessionExpirySkewMs = 30_000;
let cachedStudioMutationSession: CachedStudioMutationSession | null = null;

/**
 * Builds headers for a guarded same-origin Studio mutation request.
 *
 * @param actionId - The Studio action service contract identifier.
 * @returns Headers containing JSON, action, and local session proof.
 */
export async function studioMutationJsonHeaders(actionId: string): Promise<Record<string, string>> {
  const token = await fetchStudioSessionToken();
  return {
    "content-type": "application/json",
    [studioActionHeaderName]: actionId,
    [studioSessionHeaderName]: token,
  };
}

/**
 * Reads the current in-memory Studio mutation session state.
 *
 * @returns A snapshot of the cached local session, without creating a new one.
 */
export function readStudioMutationSessionSnapshot(): StudioMutationSessionSnapshot {
  if (!cachedStudioMutationSession || sessionIsExpiring(cachedStudioMutationSession)) {
    return { status: "missing" };
  }
  return {
    expiresAtMs: cachedStudioMutationSession.expiresAtMs,
    expiresInSeconds: Math.max(
      0,
      Math.floor((cachedStudioMutationSession.expiresAtMs - Date.now()) / 1000),
    ),
    status: "ready",
  };
}

/**
 * Refreshes the short-lived local session used for guarded Studio mutations.
 *
 * @returns The refreshed local session snapshot.
 */
export async function refreshStudioMutationSession(): Promise<StudioMutationSessionSnapshot> {
  const response = await fetch("/actions/session", {
    cache: "no-store",
    method: "GET",
  });
  const payload = (await response.json().catch(() => null)) as StudioSessionResponse | null;
  const token = payload?.token;
  const expiresInSeconds = payload?.expiresInSeconds;
  if (
    !response.ok ||
    typeof token !== "string" ||
    token.length === 0 ||
    typeof expiresInSeconds !== "number" ||
    !Number.isFinite(expiresInSeconds) ||
    expiresInSeconds <= 0
  ) {
    cachedStudioMutationSession = null;
    throw new Error("Studio local session could not be established.");
  }
  cachedStudioMutationSession = {
    expiresAtMs: Date.now() + expiresInSeconds * 1000,
    token,
  };
  return readStudioMutationSessionSnapshot();
}

/**
 * Clears the cached Studio mutation session.
 */
export function clearCachedStudioMutationSession(): void {
  cachedStudioMutationSession = null;
}

async function fetchStudioSessionToken(): Promise<string> {
  if (!cachedStudioMutationSession || sessionIsExpiring(cachedStudioMutationSession)) {
    await refreshStudioMutationSession();
  }
  if (!cachedStudioMutationSession) {
    throw new Error("Studio local session could not be established.");
  }
  return cachedStudioMutationSession.token;
}

function sessionIsExpiring(session: CachedStudioMutationSession): boolean {
  return session.expiresAtMs - Date.now() <= sessionExpirySkewMs;
}
