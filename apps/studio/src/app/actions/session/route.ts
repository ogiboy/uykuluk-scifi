import { isTrustedStudioBrowserRequest } from "../../../lib/studioMutationSecurity";
import { createStudioMutationSession } from "../../../lib/studioMutationSession";

/**
 * Issues a short-lived local Studio mutation session for same-origin guarded actions.
 *
 * @returns The session token in JSON plus a matching HttpOnly SameSite cookie.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isTrustedStudioBrowserRequest(request)) {
    return Response.json(
      {
        message: "Studio session endpoint is local-only and requires same-origin access.",
        status: "error",
      },
      { headers: { "cache-control": "no-store" }, status: 403 },
    );
  }

  const session = createStudioMutationSession();
  return Response.json(
    { expiresInSeconds: session.maxAgeSeconds, status: "ok", token: session.token },
    { headers: { "cache-control": "no-store", "set-cookie": session.cookie } },
  );
}
