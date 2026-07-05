import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs local voiceover generation through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("voice.run");
