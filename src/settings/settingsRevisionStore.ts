import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ProducerConfig, producerConfigSchema } from "../config/schema.js";
import { SafeExitError } from "../core/errors.js";
import { canonicalJsonDigest } from "../utils/canonicalJsonDigest.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { createId, nowIso } from "../utils/time.js";

const configFileName = "producer.config.json";
const digestPattern = /^[a-f0-9]{64}$/;
const settingsLockSettings = {
  timeoutMs: 5_000,
  retryMs: 20,
  staleMs: 30_000,
  hardStaleMs: 5 * 60_000,
};

export type SettingsRevision = Readonly<{
  revisionId: string;
  createdAt: string;
  editor: string;
  note: string;
  previousDigest: string;
  configDigest: string;
  changedPaths: string[];
  restartRequired: boolean;
  config: ProducerConfig;
}>;

export type SettingsSummary = Readonly<{ digest: string; config: ProducerConfig }>;

export type SaveSettingsRevisionInput = Readonly<{
  projectRoot: string;
  expectedCurrentDigest: string;
  config: ProducerConfig;
  editor: string;
  note: string;
  restartPaths?: readonly string[];
}>;

export function configDigest(config: ProducerConfig): string {
  return canonicalJsonDigest(config, configDigestMessages);
}

export async function readCurrentSettings(projectRoot: string): Promise<SettingsSummary> {
  const target = path.join(projectRoot, configFileName);
  if (!(await pathExists(target))) {
    throw new SafeExitError(`Settings config is missing: ${configFileName}`);
  }
  const config = producerConfigSchema.parse(await readJsonFile<unknown>(target));
  return { config, digest: configDigest(config) };
}

export async function listSettingsRevisions(projectRoot: string): Promise<SettingsRevision[]> {
  const revisionsPath = path.join(projectRoot, "producer.config.revisions");
  if (!(await pathExists(revisionsPath))) return [];
  const { readdir } = await import("node:fs/promises");
  const entries = (await readdir(revisionsPath)).filter((entry) => entry.endsWith(".json"));
  entries.sort((left, right) => left.localeCompare(right));
  return Promise.all(entries.map((entry) => readSettingsRevision(projectRoot, entry.slice(0, -5))));
}

export async function readSettingsRevision(
  projectRoot: string,
  revisionId: string,
): Promise<SettingsRevision> {
  validateRevisionId(revisionId);
  const target = path.join(projectRoot, "producer.config.revisions", `${revisionId}.json`);
  if (!(await pathExists(target)))
    throw new SafeExitError(`Settings revision not found: ${revisionId}`);
  const revision = settingsRevisionSchema.parse(await readJsonFile<unknown>(target));
  if (revision.configDigest !== configDigest(revision.config)) {
    throw new SafeExitError("Settings revision config digest does not match its config.");
  }
  return revision;
}

export async function saveSettingsRevision(
  input: SaveSettingsRevisionInput,
): Promise<SettingsRevision> {
  validateSaveInput(input);
  return withSettingsSaveLock(input.projectRoot, async () => {
    const current = await readCurrentSettings(input.projectRoot);
    if (current.digest !== input.expectedCurrentDigest) {
      throw new SafeExitError(
        "Settings changed before this save could be applied; reload and review the current config.",
      );
    }
    const requested = producerConfigSchema.parse(input.config);
    const candidate = producerConfigSchema.parse({
      ...requested,
      settingsRevision: current.config.settingsRevision,
    });
    rejectSecretLikeValues(candidate);
    const changedPaths = collectChangedPaths(current.config, candidate);
    if (changedPaths.length === 0)
      throw new SafeExitError("Settings revision must change the current config.");
    const config = producerConfigSchema.parse({
      ...candidate,
      settingsRevision: current.config.settingsRevision + 1,
    });
    const revisionId = createId("settings");
    const revision: SettingsRevision = {
      revisionId,
      createdAt: nowIso(),
      editor: input.editor.trim(),
      note: input.note.trim(),
      previousDigest: current.digest,
      configDigest: configDigest(config),
      changedPaths,
      restartRequired: changedPaths.some((changed) =>
        (input.restartPaths ?? ["studio.port"]).includes(changed),
      ),
      config,
    };
    await writeJsonFile(
      path.join(input.projectRoot, "producer.config.revisions", `${revisionId}.json`),
      revision,
    );
    await writeJsonFile(path.join(input.projectRoot, configFileName), config);
    return revision;
  });
}

const settingsRevisionSchema = z.object({
  revisionId: z.string().regex(/^settings_[a-z0-9_]+$/),
  createdAt: z.stringFormat(
    "iso-datetime",
    z.regexes.datetime({ precision: null, offset: false, local: false }),
  ),
  editor: z.string().min(1).max(160),
  note: z.string().min(1).max(1_000),
  previousDigest: z.string().regex(digestPattern),
  configDigest: z.string().regex(digestPattern),
  changedPaths: z.array(z.string().min(1)).min(1),
  restartRequired: z.boolean(),
  config: producerConfigSchema,
});

const configDigestMessages = {
  nonFiniteNumber: "Settings config cannot contain a non-finite number.",
  unsupportedValue: "Settings config contains an unsupported value.",
};

function validateSaveInput(input: SaveSettingsRevisionInput): void {
  if (!digestPattern.test(input.expectedCurrentDigest))
    throw new SafeExitError("Expected settings digest is invalid.");
  if (!isSafeText(input.editor, 160))
    throw new SafeExitError("Settings editor is missing or unsafe.");
  if (!isSafeText(input.note, 1_000))
    throw new SafeExitError("Settings revision note is missing or unsafe.");
}

function validateRevisionId(revisionId: string): void {
  if (!/^settings_[a-z0-9_]+$/.test(revisionId))
    throw new SafeExitError("Settings revision id is invalid.");
}

function isSafeText(value: string, maximum: number): boolean {
  return value.trim().length > 0 && value.length <= maximum && hasOnlySafeControlCharacters(value);
}

function hasOnlySafeControlCharacters(value: string): boolean {
  return [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 || character === "\n" || character === "\r" || character === "\t";
  });
}

async function withSettingsSaveLock<T>(projectRoot: string, task: () => Promise<T>): Promise<T> {
  const target = path.join(path.resolve(projectRoot), ".settings-mutation.lock");
  const token = randomUUID();
  await acquireSettingsLock(target, token);
  let taskFailed = false;
  try {
    return await task();
  } catch (error) {
    taskFailed = true;
    throw error;
  } finally {
    if (taskFailed) {
      await releaseSettingsLock(target, token).catch(() => undefined);
    } else {
      await releaseSettingsLock(target, token);
    }
  }
}

async function acquireSettingsLock(target: string, token: string): Promise<void> {
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
      if (await reclaimStaleSettingsLock(target)) continue;
      if (Date.now() - startedAt >= settingsLockSettings.timeoutMs) {
        throw new SafeExitError("Timed out waiting for the settings mutation lock.");
      }
      await delay(settingsLockSettings.retryMs);
    }
  }
}

async function reclaimStaleSettingsLock(target: string): Promise<boolean> {
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new SafeExitError("Settings mutation lock path is unsafe.");
    }
    const ageMs = Date.now() - info.mtimeMs;
    if (ageMs <= settingsLockSettings.staleMs) return false;
    const owner = await readSettingsLockOwner(target);
    if (ageMs <= settingsLockSettings.hardStaleMs && isProcessAlive(owner?.pid)) return false;
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

async function readSettingsLockOwner(
  target: string,
): Promise<{ pid?: number; token?: string } | undefined> {
  try {
    return JSON.parse(await readFile(path.join(target, "owner.json"), "utf8")) as {
      pid?: number;
      token?: string;
    };
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

async function releaseSettingsLock(target: string, token: string): Promise<void> {
  const owner = await readSettingsLockOwner(target);
  if (owner?.token === token) await rm(target, { recursive: true, force: true });
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function collectChangedPaths(before: unknown, after: unknown, prefix = ""): string[] {
  if (Object.is(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) return [prefix || "$"];
    return before.flatMap((value, index) =>
      collectChangedPaths(value, after[index], prefix ? `${prefix}.${index}` : String(index)),
    );
  }
  if (!isRecord(before) || !isRecord(after)) return [prefix || "$"];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  keys.sort((left, right) => left.localeCompare(right));
  return keys.flatMap((key) => collectRecordChangedPaths(before, after, prefix, key));
}

function collectRecordChangedPaths(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix: string,
  key: string,
): string[] {
  if (before[key] === undefined && after[key] === undefined) return [];
  const childPrefix = prefix ? `${prefix}.${key}` : key;
  return collectChangedPaths(before[key], after[key], childPrefix);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectSecretLikeValues(value: unknown, key = ""): void {
  if (Array.isArray(value)) return value.forEach((item) => rejectSecretLikeValues(item));
  if (!isRecord(value)) return;
  for (const [childKey, childValue] of Object.entries(value)) {
    if (
      /(?:secret|token|password|api[_-]?key)/i.test(childKey) &&
      typeof childValue === "string" &&
      childValue
    ) {
      const keyPrefix = key ? `${key}.` : "";
      throw new SafeExitError(
        `Settings must not persist secret-like field: ${keyPrefix}${childKey}`,
      );
    }
    const childPath = key ? `${key}.${childKey}` : childKey;
    rejectSecretLikeValues(childValue, childPath);
  }
}
