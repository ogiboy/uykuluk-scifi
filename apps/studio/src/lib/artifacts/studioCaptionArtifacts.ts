import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readRegisteredArtifactBytesAtProjectRoot } from "../../../../../src/core/artifactRevision";
import { runRecordSchema, type RunRecord } from "../../../../../src/core/state";
import {
  readVoiceoverAudioEvidenceAtProjectRoot,
  voiceoverAudioMetaPath,
  voiceoverAudioMetaSchema,
  voiceoverAudioPath,
  type VoiceoverAudioMeta,
} from "../../../../../src/stages/voice/voiceoverEvidence";
import type { ActiveVoiceSubtitleDescriptor } from "../../../../../src/stages/voice/voiceoverSubtitles";
import { studioRunFilePath } from "../runs/runFilePaths";

export type StudioMediaReadResult =
  { body: BodyInit; headers: Headers; status: 200 | 206 } | { status: 404 | 416 };

export type ValidatedStudioVoiceEvidence = Readonly<{
  audioDigest: string;
  meta: VoiceoverAudioMeta;
  metadataDigest: string;
  subtitle: ActiveVoiceSubtitleDescriptor;
  subtitleText: string;
}>;

export async function readStudioCaptionArtifact(
  root: string,
  runId: string,
): Promise<StudioMediaReadResult> {
  try {
    const subtitleText = await readValidatedStudioSubtitle(root, runId);
    return {
      body: srtToWebVtt(subtitleText),
      headers: new Headers({
        "Cache-Control": "no-store",
        "Content-Type": "text/vtt; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      }),
      status: 200,
    };
  } catch {
    return { status: 404 };
  }
}

/** Converts a validated persisted SRT artifact into browser-readable WebVTT. */
export function srtToWebVtt(input: string): string {
  const normalizedInput = input.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  const body = normalizedInput
    .split("\n")
    .map((line) => (line.includes("-->") ? line.replaceAll(",", ".") : line))
    .join("\n");
  return `WEBVTT\n\n${body}\n`;
}

async function readValidatedStudioSubtitle(root: string, runId: string): Promise<string> {
  return (await readValidatedStudioVoiceEvidence(root, runId)).subtitleText;
}

/** Reads Studio voice bytes only after the canonical core evidence reader reports a pass. */
export async function readValidatedStudioVoiceEvidence(
  root: string,
  runId: string,
): Promise<ValidatedStudioVoiceEvidence> {
  const statePath = studioRunFilePath(root, runId, "state.json");
  if (!statePath) throw new Error("Invalid run path.");
  const run = runRecordSchema.parse(JSON.parse(await readFile(statePath, "utf8")) as unknown);
  if (run.runId !== runId) throw new Error("Voice evidence is unavailable.");
  const canonical = await readVoiceoverAudioEvidenceAtProjectRoot(root, run);
  if (canonical.status !== "pass") {
    throw new Error(
      canonical.status === "block"
        ? canonical.message
        : `Required voice artifacts are missing: ${canonical.requiredArtifacts.join(", ")}.`,
    );
  }
  const metaBytes = await requireRegisteredBytes(root, run, voiceoverAudioMetaPath);
  const meta = voiceoverAudioMetaSchema.parse(JSON.parse(metaBytes.toString("utf8")) as unknown);
  const metadataDigest = digestBytes(metaBytes);
  if (meta.runId !== run.runId || metadataDigest !== canonical.metadataDigest) {
    throw new Error("Voiceover metadata changed after canonical validation.");
  }
  const audio = await requireRegisteredBytes(root, run, voiceoverAudioPath);
  const audioDigest = digestBytes(audio);
  if (
    audio.byteLength !== meta.output.bytes ||
    audioDigest !== meta.output.sha256 ||
    audioDigest !== canonical.digest
  ) {
    throw new Error("Voiceover audio changed after canonical validation.");
  }
  const subtitleBytes = await requireRegisteredBytes(root, run, canonical.subtitle.path);
  if (digestBytes(subtitleBytes) !== canonical.subtitle.sha256) {
    throw new Error("Voice subtitle changed after validation.");
  }
  return {
    audioDigest,
    meta,
    metadataDigest,
    subtitle: canonical.subtitle,
    subtitleText: subtitleBytes.toString("utf8"),
  };
}

async function requireRegisteredBytes(
  root: string,
  run: Pick<RunRecord, "artifacts" | "runId">,
  relativePath: string,
): Promise<Buffer> {
  const bytes = await readRegisteredArtifactBytesAtProjectRoot(root, run, relativePath);
  if (!bytes) throw new Error(`Registered voice artifact is missing: ${relativePath}.`);
  return bytes;
}

function digestBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
