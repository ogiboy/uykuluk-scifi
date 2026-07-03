import { runStudioCliMutationRoute } from "../../../lib/studioCliMutation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records the manual channel-handoff decision through the shared guarded Studio mutation path.
 *
 * @param request - The Studio JSON mutation request.
 * @returns A JSON response with the persisted channel-handoff decision, or a safe error message.
 */
export async function POST(request: Request): Promise<Response> {
  return runStudioCliMutationRoute(request, "channel-handoff.decide");
}
