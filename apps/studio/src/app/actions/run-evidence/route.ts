import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs evidence-bundle generation through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("evidence.run");
