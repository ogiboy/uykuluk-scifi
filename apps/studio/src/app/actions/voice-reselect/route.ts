import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Reopens pre-spend voice selection through the guarded Studio mutation path. */
export const POST = createStudioCliMutationPost("voice.reselect");
