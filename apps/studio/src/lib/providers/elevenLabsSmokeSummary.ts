import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
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
        JSON.parse(await readFile(path.join(directory, candidate), "utf8")),
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
      JSON.parse(
        await readFile(path.join(smokeDirectory(projectRoot), `${operationId}.json`), "utf8"),
      ),
    );
    if (evidence.status !== "succeeded" || evidence.operationId !== operationId) return null;
    const expectedPath = `diagnostics/provider-smokes/elevenlabs/${operationId}.wav`;
    if (evidence.audio.path !== expectedPath) return null;
    const audio = await readFile(path.join(projectRoot, expectedPath));
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
