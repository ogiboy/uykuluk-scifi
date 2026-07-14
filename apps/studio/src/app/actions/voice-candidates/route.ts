import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Fetches the persisted voice candidate catalog through the guarded Studio mutation path. */
export const POST = createStudioCliMutationPost("voice.candidates");
