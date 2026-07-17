import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Saves one prompt-profile edit through the revisioned settings contract. */
export const POST = createStudioCliMutationPost("promptProfiles.save");
