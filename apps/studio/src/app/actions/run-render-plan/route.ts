import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs render-plan generation through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("render-plan.run");
