import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records explicit local script approval through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("script.approve");
