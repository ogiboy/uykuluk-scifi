import { ZodError } from "zod";
import { captureStudioUnexpectedError } from "../observability/studioObservability";
import { cliArgsForAction, type StudioCliMutationActionId } from "./studioCliMutationArgs";
import { studioCliHttpStatus } from "./studioCliProcessLimits";
import { runProducerCli, type StudioCliResult } from "./studioCliProcessRunner";
import { validateStudioMutationRequest } from "./studioMutationSecurity";

export type { StudioCliMutationActionId } from "./studioCliMutationArgs";
export type { StudioCliResult } from "./studioCliProcessRunner";

export type StudioCliMutationRouteDependencies = Readonly<{
  prepareCli?: typeof cliArgsForAction;
  runCli?: (args: readonly string[]) => Promise<StudioCliResult>;
}>;

const cleanupWarning =
  "The producer CLI finished, but Studio could not remove every temporary input file.";

/**
 * Runs a guarded Studio mutation through the canonical producer CLI.
 *
 * The Studio route owns browser boundary checks only. The CLI/core still owns state transitions,
 * approval guards, durable evidence writes, and operator-facing blockers.
 *
 * @param request - The incoming Studio JSON request.
 * @param actionId - The enabled local mutation action.
 * @returns A JSON response with the persisted CLI record or a safe error message.
 */
export async function runStudioCliMutationRoute(
  request: Request,
  actionId: StudioCliMutationActionId,
  dependencies: StudioCliMutationRouteDependencies = {},
): Promise<Response> {
  const security = validateStudioMutationRequest(request, actionId);
  if (!security.ok) {
    return jsonError(security.message, security.status);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Studio mutation request body must be valid JSON.", 400);
  }

  try {
    const cli = await (dependencies.prepareCli ?? cliArgsForAction)(actionId, payload);
    const execution = await runProducerCliWithCleanup(
      cli.args,
      cli.cleanup,
      dependencies.runCli ?? runProducerCli,
    );
    const warnings = execution.cleanupError ? [cleanupWarning] : [];
    if (execution.cleanupError) {
      captureStudioUnexpectedError(execution.cleanupError, {
        actionId,
        boundary: "route-mutation",
        routePath: new URL(request.url).pathname,
      });
    }
    const result = execution.result;
    if (result.status !== 0) {
      return jsonError(
        cliErrorMessage(result.stderr),
        studioCliHttpStatus(result.status),
        parseCliJsonOrNull(result.stdout),
        warnings,
      );
    }
    return Response.json(
      { actionId, record: parseCliJson(result.stdout), status: "ok", warnings },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(`Studio ${actionId} request is invalid.`, 400);
    }
    captureStudioUnexpectedError(error, {
      actionId,
      boundary: "route-mutation",
      routePath: new URL(request.url).pathname,
    });
    return jsonError(`Studio ${actionId} failed unexpectedly.`, 500);
  }
}

async function runProducerCliWithCleanup(
  args: readonly string[],
  cleanup: () => Promise<void>,
  runCli: (args: readonly string[]) => Promise<StudioCliResult>,
): Promise<Readonly<{ cleanupError: unknown | null; result: StudioCliResult }>> {
  const outcome = await runCli(args).then(
    (result) => ({ kind: "result" as const, result }),
    (error: unknown) => ({ error, kind: "error" as const }),
  );
  let cleanupError: unknown | null = null;
  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }
  if (outcome.kind === "error") {
    if (cleanupError) {
      throw new AggregateError(
        [outcome.error, cleanupError],
        "Producer CLI execution and temporary input cleanup both failed.",
      );
    }
    throw outcome.error;
  }
  return { cleanupError, result: outcome.result };
}

function jsonError(
  message: string,
  status: number,
  record: unknown = null,
  warnings: readonly string[] = [],
): Response {
  return Response.json(
    { message, ...(record ? { record } : {}), status: "error", warnings },
    { headers: noStoreHeaders(), status },
  );
}

function noStoreHeaders(): HeadersInit {
  return { "cache-control": "no-store" };
}

function parseCliJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout.trim());
  } catch {
    throw new Error("Studio mutation CLI returned invalid JSON.");
  }
}

function parseCliJsonOrNull(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function cliErrorMessage(stderr: string): string {
  const message = stderr.trim();
  return message || "Studio mutation was blocked by the producer CLI.";
}
