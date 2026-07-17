import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Saves one immutable revision of the non-secret producer settings. */
export const POST = createStudioCliMutationPost("settings.save");
