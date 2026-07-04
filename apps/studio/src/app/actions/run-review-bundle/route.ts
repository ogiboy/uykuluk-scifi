import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs local final review bundle creation through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("review-bundle.run");
