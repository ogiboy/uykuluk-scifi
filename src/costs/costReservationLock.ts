import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { SafeExitError } from "../core/errors";
import { runsDir } from "../core/runStore";

type LockOptions = {
  timeoutMs?: number;
  retryMs?: number;
  staleMs?: number;
};

const defaultOptions = {
  timeoutMs: 5_000,
  retryMs: 20,
  staleMs: 120_000,
};

export function reservationLockPath(): string {
  return path.join(runsDir(), ".cost-reservation.lock");
}

export async function withCostReservationLock<T>(
  task: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const settings = { ...defaultOptions, ...options };
  const target = reservationLockPath();
  const token = randomUUID();
  await acquireLock(target, token, settings);
  try {
    return await task();
  } finally {
    await releaseOwnedLock(target, token);
  }
}

async function acquireLock(
  target: string,
  token: string,
  settings: Required<LockOptions>,
): Promise<void> {
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
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw error;
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

async function readLockOwner(target: string): Promise<{ pid?: number } | undefined> {
  try {
    return JSON.parse(await readFile(path.join(target, "owner.json"), "utf8")) as {
      pid?: number;
    };
  } catch {
    return undefined;
  }
}

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

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
