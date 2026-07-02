import { runStudioCliMutationRoute } from "../../../lib/studioCliMutation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records explicit local render approval through the shared guarded Studio mutation path.
 *
 * @param request - The Studio JSON mutation request.
 * @returns A JSON response with the persisted approval, or a safe error message.
 */
export async function POST(request: Request): Promise<Response> {
  return runStudioCliMutationRoute(request, "render.approve");
}
