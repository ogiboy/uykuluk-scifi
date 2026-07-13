import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { SafeExitError } from "./errors.js";
import { runPath } from "./runPaths.js";

const lockSettings = { timeoutMs: 5_000, retryMs: 20, staleMs: 30_000, hardStaleMs: 5 * 60_000 };

interface RunStateLockOwner {
  pid?: number;
  token?: string;
}

/** Serializes compare-and-save mutations for one run state file. */
export async function withRunStateLock<T>(runId: string, task: () => Promise<T>): Promise<T> {
  const target = runPath(runId, ".state-mutation.lock");
  const token = randomUUID();
  await acquireLock(target, token);
  let taskFailed = false;
  try {
    return await task();
  } catch (error) {
    taskFailed = true;
    throw error;
  } finally {
    if (taskFailed) {
      await releaseOwnedLock(target, token).catch(() => undefined);
    } else {
      await releaseOwnedLock(target, token);
    }
  }
}

async function acquireLock(target: string, token: string): Promise<void> {
  const startedAt = Date.now();
  while (true) {
    try {
      await mkdir(target);
      try {
        await writeFile(
          path.join(target, "owner.json"),
          `${JSON.stringify({ token, pid: process.pid, createdAt: new Date().toISOString() })}\n`,
          "utf8",
        );
      } catch (error) {
        await rm(target, { recursive: true, force: true });
        throw error;
      }
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await reclaimStaleLock(target)) continue;
      if (Date.now() - startedAt >= lockSettings.timeoutMs) {
        throw new SafeExitError("Timed out waiting for the run state mutation lock.");
      }
      await delay(lockSettings.retryMs);
    }
  }
}

async function reclaimStaleLock(target: string): Promise<boolean> {
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new SafeExitError("Run state mutation lock path is unsafe.");
    }
    const ageMs = Date.now() - info.mtimeMs;
    if (ageMs <= lockSettings.staleMs) return false;
    const owner = await readLockOwner(target);
    if (ageMs <= lockSettings.hardStaleMs && isProcessAlive(owner?.pid)) return false;
    const quarantine = `${target}.stale.${randomUUID()}`;
    await rename(target, quarantine);
    await rm(quarantine, { recursive: true, force: true });
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EEXIST") return true;
    throw error;
  }
}

async function readLockOwner(target: string): Promise<RunStateLockOwner | undefined> {
  try {
    const owner = JSON.parse(
      await readFile(path.join(target, "owner.json"), "utf8"),
    ) as RunStateLockOwner;
    return owner;
  } catch (error) {
    if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function isProcessAlive(pid: number | undefined): boolean {
  if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function releaseOwnedLock(target: string, token: string): Promise<void> {
  const owner = await readLockOwner(target);
  if (owner?.token === token) await rm(target, { recursive: true, force: true });
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
