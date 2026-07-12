import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records a manual channel-handoff decision through the shared guarded Studio mutation path.
 */
export const POST = createStudioCliMutationPost("channel-handoff.decide");
