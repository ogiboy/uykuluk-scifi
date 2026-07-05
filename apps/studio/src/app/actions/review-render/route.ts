import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs draft-render review through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("render.review");
