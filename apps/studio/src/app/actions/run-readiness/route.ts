import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs readiness diagnostics through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("readiness.run");
