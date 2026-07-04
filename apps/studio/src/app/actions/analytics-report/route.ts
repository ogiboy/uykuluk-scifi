import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Refreshes the manual analytics report through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("analytics.report");
