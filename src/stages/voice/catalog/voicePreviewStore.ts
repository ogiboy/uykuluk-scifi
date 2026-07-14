import { createHash } from "node:crypto";
import { SafeExitError } from "../../../core/errors.js";
import { loadRun } from "../../../core/runStore.js";
import {
  isVoicePreviewAudioArtifactPath,
  isVoicePreviewEvidenceArtifactPath,
  isVoicePreviewFailureArtifactPath,
  voicePreviewEvidenceSchema,
  voicePreviewFailurePath,
  voicePreviewFailureSchema,
  type VoicePreviewEvidence,
} from "./voiceAuditionContracts.js";
import type { VoiceCandidates } from "./voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voiceCatalogDigest.js";
import { requireCatalogCandidate } from "./voiceCatalogGuards.js";
import {
  readVoiceCandidatesWithPathAtProjectRoot,
  requireCurrentVoiceCatalog,
  requireRegisteredBytes,
  type VoiceCatalogRun,
} from "./voiceCatalogRead.js";
import { assertVoicePreviewMatchesCatalog } from "./voiceSelectionIntegrity.js";

/** Loads validated preview evidence for a voice candidate in a run. */
export async function readVoicePreviewEvidence(
  runId: string,
  voiceId: string,
): Promise<VoicePreviewEvidence> {
  return (await readVoicePreviewEvidenceWithPath(runId, voiceId)).evidence;
}

/** Loads and validates the latest voice preview evidence for a candidate. */
export async function readVoicePreviewEvidenceWithPath(
  runId: string,
  voiceId: string,
): Promise<{ path: string; evidence: VoicePreviewEvidence }> {
  const run = await loadRun(runId);
  const result = await readVoicePreviewEvidenceWithPathAtProjectRoot(process.cwd(), run, voiceId);
  return { evidence: result.evidence, path: result.path };
}

/** Validates the latest candidate preview and returns the exact verified audio bytes. */
export async function readCurrentVoicePreviewMediaAtProjectRoot(input: {
  projectRoot: string;
  run: VoiceCatalogRun;
  voiceId: string;
  catalog?: VoiceCandidates;
  requestedPath?: string;
  nowMs?: number;
}): Promise<{
  audio: Buffer;
  candidate: ReturnType<typeof requireCatalogCandidate>;
  evidence: VoicePreviewEvidence;
  path: string;
}> {
  const catalog =
    input.catalog ??
    (await readVoiceCandidatesWithPathAtProjectRoot(input.projectRoot, input.run)).catalog;
  requireCurrentVoiceCatalog(catalog, input.nowMs);
  const candidate = requireCatalogCandidate(catalog, input.voiceId, input.nowMs);
  const preview = await readVoicePreviewEvidenceWithPathAtProjectRoot(
    input.projectRoot,
    input.run,
    input.voiceId,
  );
  assertVoicePreviewMatchesCatalog(catalog, candidate, preview.evidence);
  if (input.requestedPath && preview.evidence.output.path !== input.requestedPath) {
    throw new SafeExitError("Requested voice preview is not the current persisted output.");
  }
  return { ...preview, candidate };
}

async function readVoicePreviewEvidenceWithPathAtProjectRoot(
  projectRoot: string,
  run: VoiceCatalogRun,
  voiceId: string,
): Promise<{ audio: Buffer; path: string; evidence: VoicePreviewEvidence }> {
  const path = await requireLatestVoicePreviewArtifact(projectRoot, run, voiceId);
  const evidenceBytes = await requireRegisteredBytes(projectRoot, run, path);
  const evidence = voicePreviewEvidenceSchema.parse(
    JSON.parse(evidenceBytes.toString("utf8")) as unknown,
  );
  if (evidence.runId !== run.runId || evidence.candidate.voiceId !== voiceId) {
    throw new SafeExitError("Voice preview evidence belongs to a different run or candidate.");
  }
  if (
    !isVoicePreviewAudioArtifactPath(evidence.output.path, voiceId) ||
    !previewPathsShareGeneration(path, evidence.output.path, evidence.output.format)
  ) {
    throw new SafeExitError("Voice preview evidence points at a different candidate audio path.");
  }
  const { previewDigest, ...digestInput } = evidence;
  if (canonicalVoiceEvidenceDigest(digestInput) !== previewDigest) {
    throw new SafeExitError("Voice preview evidence digest does not match its persisted content.");
  }
  const audio = await requireRegisteredBytes(projectRoot, run, evidence.output.path);
  if (
    audio.byteLength !== evidence.output.bytes ||
    sha256Buffer(audio) !== evidence.output.sha256
  ) {
    throw new SafeExitError("Voice preview audio does not match its evidence digest.");
  }
  return { audio, path, evidence };
}

/** Computes the SHA-256 digest of a byte array. */
export function sha256Buffer(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function requireLatestVoicePreviewArtifact(
  projectRoot: string,
  run: VoiceCatalogRun,
  voiceId: string,
): Promise<string> {
  for (let index = run.artifacts.length - 1; index >= 0; index -= 1) {
    const relativePath = run.artifacts[index];
    if (isVoicePreviewEvidenceArtifactPath(relativePath, voiceId)) return relativePath;
    if (relativePath === voicePreviewFailurePath) {
      const failure = await readLegacyVoicePreviewFailure(projectRoot, run);
      if (failure.runId !== run.runId) {
        throw new SafeExitError("Legacy voice preview failure belongs to a different run.");
      }
      if (failure.voiceId === voiceId) {
        throw new SafeExitError(
          "The latest voice preview refresh failed; audition the candidate again.",
        );
      }
      continue;
    }
    if (isVoicePreviewFailureArtifactPath(relativePath, voiceId)) {
      throw new SafeExitError(
        "The latest voice preview refresh failed; audition the candidate again.",
      );
    }
  }
  throw new SafeExitError("No current voice preview evidence is registered for this candidate.");
}

async function readLegacyVoicePreviewFailure(projectRoot: string, run: VoiceCatalogRun) {
  try {
    const bytes = await requireRegisteredBytes(projectRoot, run, voicePreviewFailurePath);
    return voicePreviewFailureSchema.parse(JSON.parse(bytes.toString("utf8")) as unknown);
  } catch {
    throw new SafeExitError("Legacy voice preview failure evidence is invalid.");
  }
}

function previewPathsShareGeneration(
  evidencePath: string,
  audioPath: string,
  format: "mp3" | "wav",
): boolean {
  return audioPath === evidencePath.replace(/\.json$/u, `.${format}`);
}
