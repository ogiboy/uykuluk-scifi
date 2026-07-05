import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records explicit local render approval through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("render.approve");
