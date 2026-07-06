import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs local model candidate comparison through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("model-eval-candidates.run");
