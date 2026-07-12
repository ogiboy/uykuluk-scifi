import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs single-model local evaluation through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("model-eval.run");
