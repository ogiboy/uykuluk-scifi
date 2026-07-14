import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";

export type SelectedAuditionArtifacts = {
  catalog: string;
  previewEvidence: string;
  previewAudio: string;
  selection: string;
};

export async function writeSelectedAuditionArtifacts(
  runId: string,
  suffix: string,
): Promise<SelectedAuditionArtifacts> {
  const artifacts = {
    catalog: `production/audio/voice-candidates/catalog_${suffix}.json`,
    previewEvidence: `production/audio/voice-previews/voice_${suffix}/preview_${suffix}.json`,
    previewAudio: `production/audio/voice-previews/voice_${suffix}/preview_${suffix}.mp3`,
    selection: `production/audio/voice-selections/selection_${suffix}.json`,
  } satisfies SelectedAuditionArtifacts;
  for (const relativePath of Object.values(artifacts)) {
    const target = artifactPath(runId, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `{"artifact":"${relativePath}"}`, "utf8");
  }
  return artifacts;
}

export function elevenLabsTtsConfig() {
  return { ...defaultConfig.providers.tts, enabled: true, mode: "elevenlabs" as const };
}
