import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Archives a non-accepted draft through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("render.revise");
