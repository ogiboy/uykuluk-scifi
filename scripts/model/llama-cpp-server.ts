#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../src/config/config.js";
import type { ProducerConfig } from "../../src/config/schema.js";

const defaultContextSize = 8192;
const pidFile = path.join("diagnostics", "llama-server.pid");

type LlamaCppConfig = ProducerConfig["providers"]["llm"];
type Environment = Readonly<Record<string, string | undefined>>;

export type LlamaCppLaunchPlan = {
  args: string[];
  binary: string;
  modelPath: string;
  pidPath: string;
};

export async function createLlamaCppLaunchPlan(
  root: string,
  config: LlamaCppConfig,
  environment: Environment = process.env,
): Promise<LlamaCppLaunchPlan> {
  if (config.mode !== "llama.cpp") {
    throw new Error(
      "pnpm model:start requires providers.llm.mode to be llama.cpp in producer.config.json.",
    );
  }

  const baseUrl = new URL(config.llamaCppBaseUrl);
  if (baseUrl.protocol !== "http:") {
    throw new Error("pnpm model:start supports only a local http:// llama.cpp endpoint.");
  }

  const modelPath = path.isAbsolute(config.model) ? config.model : path.resolve(root, config.model);
  const modelStat = await stat(modelPath).catch(() => undefined);
  if (!modelStat?.isFile()) {
    throw new Error(`Configured llama.cpp model file is missing: ${modelPath}`);
  }

  const contextSize = positiveInteger(
    environment.LLAMA_CPP_CTX_SIZE,
    defaultContextSize,
    "LLAMA_CPP_CTX_SIZE",
  );
  const port = positiveInteger(baseUrl.port, 80, "llamaCppBaseUrl port");
  const binary = environment.LLAMA_CPP_SERVER_BINARY?.trim() || "llama-server";

  return {
    binary,
    modelPath,
    pidPath: path.join(root, pidFile),
    args: [
      "--model",
      modelPath,
      "--alias",
      config.model,
      "--host",
      baseUrl.hostname,
      "--port",
      String(port),
      "--ctx-size",
      String(contextSize),
      "--parallel",
      "1",
    ],
  };
}

async function startServer(): Promise<void> {
  const root = process.cwd();
  const config = await loadConfig();
  const plan = await createLlamaCppLaunchPlan(root, config.providers.llm);
  await rejectRunningServer(plan.pidPath);
  await mkdir(path.dirname(plan.pidPath), { recursive: true });

  console.log(
    `Starting llama.cpp model ${config.providers.llm.model} on ${config.providers.llm.llamaCppBaseUrl} (ctx=${plan.args[plan.args.indexOf("--ctx-size") + 1]}, parallel=1).`,
  );
  const child = spawn(plan.binary, plan.args, { stdio: "inherit" });
  await writeFile(plan.pidPath, `${child.pid}\n`, { encoding: "utf8", mode: 0o600 });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        console.log(`llama-server stopped by ${signal}.`);
      }
      resolve(code ?? 0);
    });
  }).finally(async () => {
    await rm(plan.pidPath, { force: true });
  });

  process.exitCode = exitCode;
}

async function stopServer(): Promise<void> {
  const target = path.join(process.cwd(), pidFile);
  const pid = await readPid(target);
  if (pid === undefined) {
    console.log("No managed llama-server PID was found.");
    return;
  }
  if (!isProcessRunning(pid)) {
    await rm(target, { force: true });
    console.log("Removed a stale llama-server PID file.");
    return;
  }

  process.kill(pid, "SIGTERM");
  console.log(`Sent SIGTERM to managed llama-server process ${pid}.`);
}

async function rejectRunningServer(target: string): Promise<void> {
  const pid = await readPid(target);
  if (pid === undefined) {
    return;
  }
  if (isProcessRunning(pid)) {
    throw new Error(`A managed llama-server process is already running with PID ${pid}.`);
  }
  await rm(target, { force: true });
}

async function readPid(target: string): Promise<number | undefined> {
  const value = await readFile(target, "utf8").catch(() => undefined);
  if (value === undefined) {
    return undefined;
  }
  const pid = Number.parseInt(value.trim(), 10);
  return Number.isSafeInteger(pid) && pid > 0 ? pid : undefined;
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function positiveInteger(value: string | undefined, fallback: number, label: string): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function printHelp(): void {
  console.log(`Usage: pnpm model:start | pnpm model:stop

Starts or stops the llama.cpp server described by ignored producer.config.json.
Optional environment variables:
  LLAMA_CPP_SERVER_BINARY  llama-server binary path (default: llama-server)
  LLAMA_CPP_CTX_SIZE       context size (default: ${defaultContextSize})
`);
}

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);
  if (command === "start") {
    await startServer();
    return;
  }
  if (command === "stop") {
    await stopServer();
    return;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  throw new Error("Expected model server command: start or stop.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    await main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
