import { projectRoot } from "../../../../../lib/projectRoot";
import { readStudioVisualMedia } from "../../../../../lib/runs/visualSummaries";

type VisualRouteContext = Readonly<{ params: Promise<{ runId: string; sceneIndex: string }> }>;

/** Serves one current digest-verified visual revision for local Studio review. */
export async function GET(request: Request, context: VisualRouteContext): Promise<Response> {
  const { runId, sceneIndex } = await context.params;
  const searchParams = new URL(request.url).searchParams;
  const result = await readStudioVisualMedia(
    projectRoot(),
    runId,
    Number(sceneIndex),
    searchParams.get("manifestDigest") ?? "",
    Number(searchParams.get("revision")),
    request.headers.get("range"),
  );
  if (result.status === 416) {
    return new Response(null, { headers: { "Cache-Control": "no-store" }, status: 416 });
  }
  if (result.status === 404) {
    return new Response("Visual not available.", {
      headers: { "Cache-Control": "no-store" },
      status: 404,
    });
  }
  return new Response(result.body, { headers: result.headers, status: result.status });
}
