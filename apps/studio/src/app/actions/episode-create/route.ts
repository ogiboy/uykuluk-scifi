import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Creates a new episode with its immutable brief and settings snapshots. */
export const POST = createStudioCliMutationPost("episodes.create");
