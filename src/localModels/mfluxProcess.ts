import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { SafeExitError } from "../core/errors.js";

const helperPath = fileURLToPath(new URL("../../tools/mflux/worker.py", import.meta.url));
const maximumCapturedOutputBytes = 16 * 1024;

const mfluxWorkerResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ok"),
    operation: z.enum(["setup", "verify", "smoke", "generate"]),
    durationMs: z.int().nonnegative().optional(),
  }),
  z.strictObject({ status: z.literal("error"), code: z.string().regex(/^[a-z0-9-]{1,80}$/) }),
]);

export type MfluxWorkerResult = Extract<z.infer<typeof mfluxWorkerResultSchema>, { status: "ok" }>;

export type MfluxWorkerRequest =
  | Readonly<{ operation: "setup" | "verify"; runtimePath: string }>
  | Readonly<{ operation: "smoke"; outputPath: string; runtimePath: string }>
  | Readonly<{
      operation: "generate";
      outputPath: string;
      promptPath: string;
      runtimePath: string;
      seed: number;
    }>;

type SpawnProcess = typeof spawn;

/** Executes only the pinned MFLUX helper contract with a bounded child-process lifetime. */
export async function executeMfluxWorker(
  projectRoot: string,
  request: MfluxWorkerRequest,
  timeoutMs: number,
  spawnProcess: SpawnProcess = spawn,
): Promise<MfluxWorkerResult> {
  const args = buildArguments(projectRoot, request);
  const output = await runBoundedProcess(
    "uv",
    args,
    path.resolve(projectRoot),
    timeoutMs,
    spawnProcess,
  );
  const parsed = parseWorkerResult(output);
  if (!parsed) {
    throw new SafeExitError("The local MFLUX worker returned an invalid diagnostic response.");
  }
  if (parsed.status === "error") {
    throw new SafeExitError(`The local MFLUX worker failed (${parsed.code}).`);
  }
  if (parsed.operation !== request.operation) {
    throw new SafeExitError("The local MFLUX worker completed a different operation.");
  }
  return parsed;
}

function parseWorkerResult(output: string): z.infer<typeof mfluxWorkerResultSchema> | undefined {
  for (const line of output.trim().split("\n").reverse()) {
    try {
      return mfluxWorkerResultSchema.parse(JSON.parse(line));
    } catch {
      // uv may emit setup diagnostics around the worker's single JSON result.
    }
  }
  return undefined;
}

function buildArguments(projectRoot: string, request: MfluxWorkerRequest): string[] {
  return [
    ...(request.operation === "setup" ? [] : ["--offline"]),
    "run",
    "--locked",
    ...(request.operation === "setup" ? [] : ["--no-sync"]),
    "--project",
    path.join(path.resolve(projectRoot), "tools", "mflux"),
    "python",
    helperPath,
    "--operation",
    request.operation,
    "--runtime-path",
    request.runtimePath,
    ...(request.operation === "smoke" || request.operation === "generate"
      ? ["--output-path", request.outputPath]
      : []),
    ...(request.operation === "generate"
      ? ["--prompt-path", request.promptPath, "--seed", String(request.seed)]
      : []),
  ];
}

function runBoundedProcess(
  command: string,
  args: readonly string[],
  cwd: string,
  timeoutMs: number,
  spawnProcess: SpawnProcess,
): Promise<string> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60 * 60 * 1_000) {
    throw new SafeExitError("The local MFLUX worker timeout is outside the supported bounds.");
  }
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, {
      cwd,
      env: childEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let timedOut = false;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const capture = (chunk: Buffer) => {
      output = `${output}${chunk.toString("utf8")}`.slice(-maximumCapturedOutputBytes);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      if (forceKill) clearTimeout(forceKill);
    };
    const finish = (result: { error?: Error; output?: string }) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (result.error) reject(result.error);
      else resolve(result.output ?? "");
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKill = setTimeout(() => child.kill("SIGKILL"), 2_000);
    }, timeoutMs);

    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    child.on("error", (error) =>
      finish({
        error: timedOut
          ? new SafeExitError(`The local MFLUX worker timed out after ${timeoutMs}ms.`)
          : new SafeExitError(
              `The local MFLUX worker could not start (${(error as NodeJS.ErrnoException).code ?? "unknown"}).`,
            ),
      }),
    );
    child.on("close", (code) => {
      if (timedOut) {
        finish({
          error: new SafeExitError(`The local MFLUX worker timed out after ${timeoutMs}ms.`),
        });
        return;
      }
      if (code !== 0 && !output.trim()) {
        finish({
          error: new SafeExitError(
            `The local MFLUX worker stopped with exit code ${code ?? "unknown"}.`,
          ),
        });
        return;
      }
      finish({ output });
    });
  });
}

function childEnvironment(): NodeJS.ProcessEnv {
  const allowed = [
    "HOME",
    "LANG",
    "LC_ALL",
    "PATH",
    "TMPDIR",
    "UV_CACHE_DIR",
    "XDG_CACHE_HOME",
  ] as const;
  const environment: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV ?? "production" };
  for (const name of allowed) {
    if (process.env[name] !== undefined) environment[name] = process.env[name];
  }
  return environment;
}
