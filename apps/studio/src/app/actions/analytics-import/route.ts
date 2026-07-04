import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Imports manual analytics through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("analytics.import");
