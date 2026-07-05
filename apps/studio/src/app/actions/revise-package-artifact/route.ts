import { createStudioCliMutationPost } from "../../../lib/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records a bounded production-package artifact revision through the guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("package-artifact.revise");
