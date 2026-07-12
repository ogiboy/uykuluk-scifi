import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs cost-estimate generation through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("estimate.run");
