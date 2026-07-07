import { createStudioMutationSession } from "../../../lib/studioMutationSession";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Issues a short-lived local Studio mutation session for same-origin guarded actions.
 *
 * @returns The session token in JSON plus a matching HttpOnly SameSite cookie.
 */
export async function GET(): Promise<Response> {
  const session = createStudioMutationSession();
  return Response.json(
    { expiresInSeconds: session.maxAgeSeconds, status: "ok", token: session.token },
    { headers: { "cache-control": "no-store", "set-cookie": session.cookie } },
  );
}
