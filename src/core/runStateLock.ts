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

/**
 * Serializes state mutations for a run.
 *
 * @param runId - Identifier of the run whose state is being mutated
 * @param task - Mutation to execute while the run's state lock is held
 * @returns The result produced by `task`
 */
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

/**
 * Acquires the run state mutation lock at the specified path.
 *
 * @param target - The lock directory path
 * @param token - The token identifying the lock owner
 */
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

/**
 * Reclaims a stale run state mutation lock.
 *
 * @param target - The lock directory path to inspect and reclaim
 * @returns `true` if the lock was reclaimed or is unavailable due to a filesystem race, `false` if it remains active
 * @throws `SafeExitError` If the lock path is symbolic or is not a directory
 */
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

/**
 * Reads the recorded owner information for a run-state lock.
 *
 * @param target - The lock directory path
 * @returns The parsed lock owner, or `undefined` if the owner file is missing or contains invalid JSON
 */
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

/**
 * Determines whether a process identifier appears to refer to a running process.
 *
 * @param pid - The process identifier to check.
 * @returns `true` if the process appears to be alive, `false` otherwise.
 */
function isProcessAlive(pid: number | undefined): boolean {
  if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

/**
 * Releases the lock at the specified path when it is owned by the provided token.
 *
 * @param target - The lock directory path
 * @param token - The ownership token to verify
 */
async function releaseOwnedLock(target: string, token: string): Promise<void> {
  const owner = await readLockOwner(target);
  if (owner?.token === token) await rm(target, { recursive: true, force: true });
}

/**
 * Waits for the specified duration.
 *
 * @param ms - The delay duration in milliseconds
 */
async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
