import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs voiceover review through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("voice.review");
