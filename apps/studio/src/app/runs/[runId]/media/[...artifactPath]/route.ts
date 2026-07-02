import { projectRoot } from "../../../../../lib/projectRoot";
import { readStudioMediaArtifact } from "../../../../../lib/studioMediaArtifacts";

type RunMediaRouteContext = Readonly<{
  params: Promise<{ artifactPath: string[]; runId: string }>;
}>;

/**
 * Streams allowlisted local run media artifacts for browser-only operator review.
 *
 * @param request - The browser media request, including optional byte range.
 * @param context - The run ID and artifact path route params.
 * @returns A read-only media response, or a fail-closed status for unsafe paths.
 */
export async function GET(request: Request, context: RunMediaRouteContext): Promise<Response> {
  const { artifactPath, runId } = await context.params;
  const result = await readStudioMediaArtifact(
    projectRoot(),
    runId,
    artifactPath.join("/"),
    request.headers.get("range"),
  );
  if (result.status === 404) {
    return new Response("Media artifact not found.", { status: 404 });
  }
  if (result.status === 416) {
    return new Response("Requested media range is not satisfiable.", { status: 416 });
  }
  if (result.status !== 200 && result.status !== 206) {
    return new Response("Media artifact not available.", { status: 404 });
  }
  return new Response(result.body, {
    headers: result.headers,
    status: result.status,
  });
}
