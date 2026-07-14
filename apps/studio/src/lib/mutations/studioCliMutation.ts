import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { captureStudioUnexpectedError } from "../observability/studioObservability";
import { projectRoot } from "../projectRoot";
import { cliArgsForAction, type StudioCliMutationActionId } from "./studioCliMutationArgs";
import {
  appendBoundedStudioCliOutput,
  studioCliHttpStatus,
  studioCliResultStatus,
  type StudioCliTerminationReason,
} from "./studioCliProcessLimits";
import { validateStudioMutationRequest } from "./studioMutationSecurity";

export type { StudioCliMutationActionId } from "./studioCliMutationArgs";

export type StudioCliResult = Readonly<{ stderr: string; stdout: string; status: number }>;
export type StudioCliMutationRouteDependencies = Readonly<{
  prepareCli?: typeof cliArgsForAction;
  runCli?: (args: readonly string[]) => Promise<StudioCliResult>;
}>;

const cleanupWarning =
  "The producer CLI finished, but Studio could not remove every temporary input file.";

const studioCliTimeoutMs = 20 * 60 * 1000;
const studioCliKillGraceMs = 5_000;
const studioCliOutputLimitChars = 128_000;

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

function runProducerCli(args: readonly string[]): Promise<StudioCliResult> {
  return new Promise((resolve, reject) => {
    const sourceRoot = sourceProjectRoot();
    const child = spawn(
      path.join(sourceRoot, "node_modules", ".bin", "tsx"),
      [path.join(sourceRoot, "src", "cli.ts"), ...args],
      { cwd: projectRoot(), env: process.env, shell: false, windowsHide: true },
    );
    let settled = false;
    let stdout = "";
    let stderr = "";
    let terminationReason: StudioCliTerminationReason = null;
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null;
    const terminate = (
      reason: Exclude<StudioCliTerminationReason, null>,
      message: string,
    ): void => {
      if (terminationReason) {
        return;
      }
      terminationReason = reason;
      stderr = appendStderr(stderr, message);
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, studioCliKillGraceMs);
    };
    const timeout = setTimeout(() => {
      terminate(
        "timeout",
        `Studio mutation CLI exceeded ${studioCliTimeoutMs}ms and was terminated.`,
      );
    }, studioCliTimeoutMs);
    child.stdin?.end();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    const appendOutput = (channel: "stderr" | "stdout", chunk: string): void => {
      const current = channel === "stdout" ? stdout : stderr;
      const limited = appendBoundedStudioCliOutput(current, chunk, studioCliOutputLimitChars);
      if (limited.exceeded) {
        terminate(
          "output-limit",
          "Studio mutation output exceeded safety limits and command was terminated.",
        );
      }
      if (channel === "stdout") {
        stdout = limited.value;
      } else {
        stderr = limited.value;
      }
    };
    child.stdout.on("data", (chunk: string) => appendOutput("stdout", chunk));
    child.stderr.on("data", (chunk: string) => appendOutput("stderr", chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearStudioCliTimers(timeout, forceKillTimer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearStudioCliTimers(timeout, forceKillTimer);
      resolve({ stderr, stdout, status: studioCliResultStatus(terminationReason, code) });
    });
  });
}

function clearStudioCliTimers(
  timeout: ReturnType<typeof setTimeout>,
  forceKillTimer: ReturnType<typeof setTimeout> | null,
): void {
  clearTimeout(timeout);
  if (forceKillTimer) {
    clearTimeout(forceKillTimer);
  }
}

function appendStderr(current: string, message: string): string {
  return current.trim() ? `${current.trimEnd()}\n${message}` : message;
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

function sourceProjectRoot(): string {
  const candidates = [
    process.env.UYKULUK_SCIFI_SOURCE_ROOT,
    findSourceRootFromModule(),
    projectRoot(),
  ];
  for (const candidate of candidates) {
    if (candidate && isSourceProjectRoot(candidate)) {
      return candidate;
    }
  }
  return projectRoot();
}

function findSourceRootFromModule(): string | null {
  let current = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    if (isSourceProjectRoot(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function isSourceProjectRoot(candidate: string): boolean {
  return (
    existsSync(path.join(candidate, "src", "cli.ts")) &&
    existsSync(path.join(candidate, "apps", "studio", "package.json"))
  );
}
