import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records a local draft-render decision through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("render.decide");
