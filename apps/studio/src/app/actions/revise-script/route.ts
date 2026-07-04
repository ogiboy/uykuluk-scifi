import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records an attributable script revision through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("script.revise");
