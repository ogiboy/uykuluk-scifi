import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";
import {
  providerSmokeEvidenceSchema,
  type ProviderSmokeEvidence,
} from "../../../../../src/stages/providers/providerSmokeEvidence";

const operationIdPattern = /^provider_smoke_\d{14}_[a-f0-9]{6}$/;

/** Reads the most recent valid ElevenLabs diagnostic evidence for the Settings page. */
export async function readLatestElevenLabsSmoke(
  projectRoot: string,
): Promise<ProviderSmokeEvidence | null> {
  const directory = smokeDirectory(projectRoot);
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const candidates = entries
    .filter((entry) => entry.endsWith(".json") && operationIdPattern.test(entry.slice(0, -5)))
    .sort((left, right) => right.localeCompare(left));
  for (const candidate of candidates) {
    try {
      return providerSmokeEvidenceSchema.parse(
        JSON.parse(await readContainedSmokeText(projectRoot, candidate)),
      );
    } catch {
      continue;
    }
  }
  return null;
}

/** Reads digest-verified diagnostic audio without exposing arbitrary local files. */
export async function readElevenLabsSmokeAudio(
  projectRoot: string,
  operationId: string,
): Promise<Buffer | null> {
  if (!operationIdPattern.test(operationId)) return null;
  try {
    const evidence = providerSmokeEvidenceSchema.parse(
      JSON.parse(await readContainedSmokeText(projectRoot, `${operationId}.json`)),
    );
    if (evidence.status !== "succeeded" || evidence.operationId !== operationId) return null;
    const expectedPath = `diagnostics/provider-smokes/elevenlabs/${operationId}.wav`;
    if (evidence.audio.path !== expectedPath) return null;
    const audio = await readContainedSmokeFile(projectRoot, `${operationId}.wav`);
    return createHash("sha256").update(audio).digest("hex") === evidence.audio.digest
      ? audio
      : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  }
}

export function elevenLabsSmokeAudioUrl(operationId: string): string {
  return `/provider-smokes/elevenlabs/${encodeURIComponent(operationId)}/audio`;
}

function smokeDirectory(projectRoot: string): string {
  return path.join(projectRoot, "diagnostics", "provider-smokes", "elevenlabs");
}

async function readContainedSmokeText(projectRoot: string, fileName: string): Promise<string> {
  return (await readContainedSmokeFile(projectRoot, fileName)).toString("utf8");
}

/** Reads a diagnostic file only when every existing component is a safe, contained regular file. */
async function readContainedSmokeFile(projectRoot: string, fileName: string): Promise<Buffer> {
  const target = path.join(smokeDirectory(projectRoot), fileName);
  const safeComponents = [
    path.resolve(projectRoot),
    "diagnostics",
    "provider-smokes",
    "elevenlabs",
    fileName,
  ];
  for (let index = 0; index < safeComponents.length; index += 1) {
    const component = path.join(...safeComponents.slice(0, index + 1));
    const info = await lstat(component);
    if (info.isSymbolicLink()) throw new Error("Diagnostic smoke path contains a symbolic link.");
    if (index < safeComponents.length - 1 && !info.isDirectory()) {
      throw new Error("Diagnostic smoke path contains a non-directory component.");
    }
    if (index === safeComponents.length - 1 && (!info.isFile() || info.nlink !== 1)) {
      throw new Error("Diagnostic smoke path must be a safe regular file.");
    }
  }
  let handle;
  try {
    handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1) {
      throw new Error("Diagnostic smoke path must be a safe regular file.");
    }
    return await handle.readFile();
  } finally {
    await handle?.close();
  }
}
