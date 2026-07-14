import { GET as issueStudioSession } from "../../apps/studio/src/app/actions/session/route";
import {
  studioActionHeaderName,
  studioSessionHeaderName,
} from "../../apps/studio/src/lib/mutations/studioMutationSecurityContracts";

const baseUrl = "http://localhost:3000";

export type StudioUatAssert = (condition: boolean, message: string) => asserts condition;

export type StudioUatSession = Readonly<{ cookie: string; token: string }>;

/**
 * Builds a guarded same-origin Studio mutation request for product UAT route handlers.
 *
 * @param session - The short-lived local Studio session cookie and token.
 * @param routePath - The local Studio action route path.
 * @param actionHeader - The expected guarded action identifier.
 * @param body - JSON body sent to the route handler.
 * @returns A same-origin JSON request accepted by the Studio mutation boundary.
 */
export function studioJsonRequest(
  session: StudioUatSession,
  routePath: string,
  actionHeader: string,
  body: unknown,
): Request {
  return new Request(`${baseUrl}${routePath}`, {
    body: JSON.stringify(body),
    headers: {
      [studioActionHeaderName]: actionHeader,
      [studioSessionHeaderName]: session.token,
      "content-type": "application/json",
      cookie: session.cookie,
      host: "localhost:3000",
      origin: baseUrl,
    },
    method: "POST",
  });
}

/**
 * Issues a guarded Studio session for direct product UAT route-handler calls.
 *
 * @param assert - Scenario-specific assertion helper used for failure messages.
 * @returns A local session cookie and header token pair.
 */
export async function studioSessionCookie(assert: StudioUatAssert): Promise<StudioUatSession> {
  const response = await issueStudioSession(
    new Request("http://localhost:3000/actions/session", {
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      method: "GET",
    }),
  );
  const payload = (await response.json().catch(() => null)) as { token?: unknown } | null;
  const setCookie = response.headers.get("set-cookie");
  assert(response.status === 200, `Studio session returned HTTP ${response.status}.`);
  assert(typeof payload?.token === "string", "Studio session did not return a token.");
  assert(typeof setCookie === "string", "Studio session did not return a cookie.");
  return { cookie: setCookie.split(";")[0] ?? "", token: payload.token };
}
