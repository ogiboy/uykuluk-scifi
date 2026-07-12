import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs manual channel-handoff package creation through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("channel-handoff.run");
