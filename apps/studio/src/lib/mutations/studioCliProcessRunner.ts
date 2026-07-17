import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoot } from "../projectRoot";
import {
  appendBoundedStudioCliOutput,
  studioCliResultStatus,
  type StudioCliTerminationReason,
} from "./studioCliProcessLimits";

export type StudioCliResult = Readonly<{ stderr: string; stdout: string; status: number }>;

const studioCliTimeoutMs = 20 * 60 * 1000;
const hostedVisualCliTimeoutMs = 4 * 60 * 60 * 1_000 + 60 * 1_000;
const studioCliKillGraceMs = 5_000;
const studioCliOutputLimitChars = 128_000;

/**
 * Runs the canonical producer CLI within Studio's bounded local process contract.
 *
 * @param args - Arguments passed to the producer CLI
 * @returns Captured standard output, standard error, and termination status
 */
export function runProducerCli(args: readonly string[]): Promise<StudioCliResult> {
  return new Promise((resolve, reject) => {
    const sourceRoot = sourceProjectRoot();
    const child = spawn(
      path.join(sourceRoot, "node_modules", ".bin", "tsx"),
      [path.join(sourceRoot, "src", "cli.ts"), ...args],
      {
        cwd: projectRoot(),
        detached: process.platform !== "win32",
        env: process.env,
        shell: false,
        windowsHide: true,
      },
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
      if (terminationReason) return;
      terminationReason = reason;
      stderr = appendStderr(stderr, message);
      terminateStudioCliProcessTree(child, "SIGTERM");
      forceKillTimer = setTimeout(
        () => terminateStudioCliProcessTree(child, "SIGKILL"),
        studioCliKillGraceMs,
      );
    };
    const timeoutMs = studioCliTimeoutForArgs(args);
    const timeout = setTimeout(() => {
      terminate("timeout", `Studio mutation CLI exceeded ${timeoutMs}ms and was terminated.`);
    }, timeoutMs);
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
      if (channel === "stdout") stdout = limited.value;
      else stderr = limited.value;
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

/**
 * Selects the timeout for a Studio CLI invocation based on its arguments.
 *
 * @param args - The CLI arguments
 * @returns The hosted visuals timeout for `visuals generate-hosted` invocations; the standard CLI timeout otherwise
 */
export function studioCliTimeoutForArgs(args: readonly string[]): number {
  return args[0] === "visuals" && args[1] === "generate-hosted"
    ? hostedVisualCliTimeoutMs
    : studioCliTimeoutMs;
}

/**
 * Terminates the Studio CLI process and its child processes using platform-specific process-tree handling.
 *
 * @param child - The spawned CLI process to terminate.
 * @param signal - The signal to send to the process tree.
 */
function terminateStudioCliProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) {
    child.kill(signal);
    return;
  }
  if (process.platform === "win32") {
    terminateWindowsProcessTree(child, signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill(signal);
  }
}

function terminateWindowsProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  const args = ["/PID", String(child.pid), "/T"];
  if (signal === "SIGKILL") args.push("/F");
  const systemRoot = process.env.SystemRoot ?? String.raw`C:\Windows`;
  const terminator = spawn(path.join(systemRoot, "System32", "taskkill.exe"), args, {
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  let fellBack = false;
  const fallback = (): void => {
    if (fellBack) return;
    fellBack = true;
    child.kill(signal);
  };
  terminator.once("error", fallback);
  terminator.once("close", (code) => {
    if (code !== 0) fallback();
  });
}

function clearStudioCliTimers(
  timeout: ReturnType<typeof setTimeout>,
  forceKillTimer: ReturnType<typeof setTimeout> | null,
): void {
  clearTimeout(timeout);
  if (forceKillTimer) clearTimeout(forceKillTimer);
}

function appendStderr(current: string, message: string): string {
  return current.trim() ? `${current.trimEnd()}\n${message}` : message;
}

function sourceProjectRoot(): string {
  const candidates = [
    process.env.UYKULUK_SCIFI_SOURCE_ROOT,
    findSourceRootFromModule(),
    projectRoot(),
  ];
  for (const candidate of candidates) {
    if (candidate && isSourceProjectRoot(candidate)) return candidate;
  }
  return projectRoot();
}

function findSourceRootFromModule(): string | null {
  let current = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    if (isSourceProjectRoot(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function isSourceProjectRoot(candidate: string): boolean {
  return (
    existsSync(path.join(candidate, "src", "cli.ts")) &&
    existsSync(path.join(candidate, "apps", "studio", "package.json"))
  );
}
