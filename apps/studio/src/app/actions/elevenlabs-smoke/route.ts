import { createStudioCliMutationPost } from "../../../lib/mutations/studioCliMutationRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Runs one explicit diagnostic-only ElevenLabs v3 sample after entitlement preflight. */
export const POST = createStudioCliMutationPost("providers.elevenlabs.smoke");
