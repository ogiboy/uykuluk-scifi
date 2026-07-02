import {
  studioActionHeaderName,
  studioSessionCookieName,
  studioSessionHeaderName,
} from "../apps/studio/src/lib/studioMutationSecurity";

export type StudioMutationRequestOptions = Readonly<{
  actionHeader?: string;
  cookieToken?: string | null;
  origin?: string;
  sessionToken?: string | null;
}>;

export const testStudioSessionToken = "test_session_token_1234567890ABCDEFGH";

/**
 * Builds a same-origin JSON request for a guarded Studio mutation route.
 *
 * @param routePath - The Studio action route path.
 * @param defaultActionHeader - The expected Studio action header for the route.
 * @param body - The JSON request payload.
 * @param options - Header overrides for negative security tests.
 * @returns A Request object suitable for calling a route handler directly.
 */
export function studioJsonMutationRequest(
  routePath: string,
  defaultActionHeader: string,
  body: unknown,
  options: StudioMutationRequestOptions = {},
): Request {
  const sessionToken =
    options.sessionToken === undefined ? testStudioSessionToken : options.sessionToken;
  const cookieToken = options.cookieToken === undefined ? sessionToken : options.cookieToken;
  const headers: Record<string, string> = {
    [studioActionHeaderName]: options.actionHeader ?? defaultActionHeader,
    "content-type": "application/json",
    origin: options.origin ?? "http://localhost:3000",
  };
  if (sessionToken) {
    headers[studioSessionHeaderName] = sessionToken;
  }
  if (cookieToken) {
    headers.cookie = `${studioSessionCookieName}=${cookieToken}`;
  }
  return new Request(`http://localhost:3000${routePath}`, {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });
}
