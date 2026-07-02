import { studioActionHeaderName, studioSessionHeaderName } from "./studioMutationSecurity";

type StudioSessionResponse = Readonly<{
  token?: unknown;
}>;

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

async function fetchStudioSessionToken(): Promise<string> {
  const response = await fetch("/actions/session", {
    cache: "no-store",
    method: "GET",
  });
  const payload = (await response.json().catch(() => null)) as StudioSessionResponse | null;
  if (!response.ok || typeof payload?.token !== "string" || payload.token.length === 0) {
    throw new Error("Studio local session could not be established.");
  }
  return payload.token;
}
