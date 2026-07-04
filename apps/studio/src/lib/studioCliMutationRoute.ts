import { runStudioCliMutationRoute } from "./studioCliMutation";
import type { StudioCliMutationActionId } from "./studioCliMutationArgs";

/**
 * Creates a Next.js route handler for one guarded Studio CLI mutation.
 *
 * @param actionId - The action identifier bound to the route.
 * @returns A POST handler that delegates to the shared guarded mutation path.
 */
export function createStudioCliMutationPost(
  actionId: StudioCliMutationActionId,
): (request: Request) => Promise<Response> {
  return (request) => runStudioCliMutationRoute(request, actionId);
}
