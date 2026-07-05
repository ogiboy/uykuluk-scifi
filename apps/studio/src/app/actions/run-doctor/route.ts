import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs producer doctor diagnostics through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("doctor.run");
