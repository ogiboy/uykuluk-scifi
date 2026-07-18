import { projectRoot } from "../../../../../lib/projectRoot";
import { readElevenLabsSmokeAudio } from "../../../../../lib/providers/elevenLabsSmokeSummary";

type SmokeAudioRouteContext = Readonly<{ params: Promise<{ operationId: string }> }>;

/** Serves one digest-verified diagnostic-only WAV for local operator audition. */
export async function GET(_request: Request, context: SmokeAudioRouteContext): Promise<Response> {
  const { operationId } = await context.params;
  const audio = await readElevenLabsSmokeAudio(projectRoot(), operationId);
  if (!audio) {
    return new Response("Diagnostic audio not available.", {
      headers: { "Cache-Control": "no-store" },
      status: 404,
    });
  }
  return new Response(new Uint8Array(audio), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": String(audio.byteLength),
      "Content-Type": "audio/wav",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
