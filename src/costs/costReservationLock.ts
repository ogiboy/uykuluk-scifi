import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { SafeExitError } from "../core/errors.js";
import { runsPath } from "../core/runStore.js";

type LockOptions = {
  timeoutMs?: number;
  retryMs?: number;
  staleMs?: number;
  onContention?: () => void;
};

type LockSettings = Required<Pick<LockOptions, "timeoutMs" | "retryMs" | "staleMs">>;

const defaultOptions = { timeoutMs: 5_000, retryMs: 20, staleMs: 120_000 };

/**
 * Determines the filesystem path for the cost reservation lock.
 *
 * @returns The absolute path to the lock directory
 */
export function reservationLockPath(): string {
  return runsPath(".cost-reservation.lock");
}

/**
 * Executes a task while holding exclusive access to the cost reservation lock.
 *
 * Releases the lock after the task completes, including when the task fails. The optional
 * contention callback is invoked when the lock is already held.
 *
 * @param task - The asynchronous task to execute while the lock is held
 * @param options - Lock timing configuration and an optional contention callback
 * @returns The task's result
 * @throws SafeExitError If the lock cannot be acquired within the configured timeout
 */
export async function withCostReservationLock<T>(
  task: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const settings: LockSettings = {
    timeoutMs: options.timeoutMs ?? defaultOptions.timeoutMs,
    retryMs: options.retryMs ?? defaultOptions.retryMs,
    staleMs: options.staleMs ?? defaultOptions.staleMs,
  };
  const target = reservationLockPath();
  const token = randomUUID();
  await acquireLock(target, token, settings, options.onContention);
  try {
    return await task();
  } finally {
    await releaseOwnedLock(target, token);
  }
}

/**
 * Acquires the exclusive lock at the specified path, reclaiming stale locks and retrying until successful or timed out.
 *
 * @param target - The filesystem path for the lock directory
 * @param token - The unique identifier for this lock holder
 * @param settings - Lock timeout, retry delay, and stale-lock threshold settings
 * @param onContention - Optional callback invoked when the lock is already held
 * @throws SafeExitError If the lock cannot be acquired within the configured timeout
 */
async function acquireLock(
  target: string,
  token: string,
  settings: LockSettings,
  onContention: (() => void) | undefined,
): Promise<void> {
  const startedAt = Date.now();
  let contentionReported = false;
  while (true) {
    try {
      await createOwnedLock(target, token);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw error;
      }
      if (!contentionReported) {
        contentionReported = true;
        onContention?.();
      }
      if (await reclaimStaleLock(target, settings.staleMs)) {
        continue;
      }
      if (Date.now() - startedAt >= settings.timeoutMs) {
        throw new SafeExitError("Timed out waiting for the project cost reservation lock.");
      }
      await delay(settings.retryMs);
    }
  }
}

async function createOwnedLock(target: string, token: string): Promise<void> {
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
}

/**
 * Determines whether a stale lock can be reclaimed.
 *
 * Checks the lock directory's age and the viability of the recorded process. If the lock is older than `staleMs` and the owning process is no longer alive, removes the lock directory.
 *
 * @param target - The path to the lock directory
 * @returns `true` if the lock is stale and was removed, or if the directory is missing due to race conditions; `false` if the lock is still valid
 */
async function reclaimStaleLock(target: string, staleMs: number): Promise<boolean> {
  try {
    const info = await stat(target);
    if (Date.now() - info.mtimeMs <= staleMs) {
      return false;
    }
    const owner = await readLockOwner(target);
    if (isProcessAlive(owner?.pid)) {
      return false;
    }
    const quarantine = `${target}.stale.${randomUUID()}`;
    await rename(target, quarantine);
    await rm(quarantine, { recursive: true, force: true });
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EEXIST") {
      return true;
    }
    throw error;
  }
}

/**
 * Reads the owner metadata from the lock directory.
 *
 * @param target - The lock directory path
 * @returns The owner information object with an optional `pid` field, or `undefined` if the file cannot be read or parsed
 */
async function readLockOwner(target: string): Promise<{ pid?: number } | undefined> {
  try {
    return JSON.parse(await readFile(path.join(target, "owner.json"), "utf8")) as { pid?: number };
  } catch {
    return undefined;
  }
}

/**
 * Determines if a process with the given PID is alive.
 *
 * @returns `true` if the process is alive, `false` otherwise.
 */
function isProcessAlive(pid: number | undefined): boolean {
  if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

/**
 * Removes the lock directory if the stored ownership token matches the provided token.
 *
 * Ignores errors if the lock directory is missing.
 *
 * @param target - The lock directory path
 * @param token - The ownership token to verify before removal
 */
async function releaseOwnedLock(target: string, token: string): Promise<void> {
  try {
    const owner = JSON.parse(await readFile(path.join(target, "owner.json"), "utf8")) as {
      token?: string;
    };
    if (owner.token === token) {
      await rm(target, { recursive: true, force: true });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Delays execution for the specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to wait
 */
async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
