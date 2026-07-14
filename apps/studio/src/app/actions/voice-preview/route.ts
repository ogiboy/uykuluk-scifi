import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Persists one bounded voice preview through the guarded Studio mutation path. */
export const POST = createStudioCliMutationPost("voice.preview");
