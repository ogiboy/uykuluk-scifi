import { registerRunArtifactPath } from "../../core/artifactRegistration.js";
import { registeredArtifactSetRevision } from "../../core/artifactRevision.js";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { appendLedgerEvent } from "../../core/ledger.js";
import { loadRun, mutateRun } from "../../core/runStore.js";
import { writeJsonFile } from "../../utils/json.js";
import { createId, nowIso } from "../../utils/time.js";
import { verifyProductionPackage } from "../production/productionPackageIntegrity.js";
import {
  isVoicePreviewAudioArtifactPath,
  isVoicePreviewEvidenceArtifactPath,
  isVoicePreviewFailureArtifactPath,
  isVoiceSelectionArtifactPath,
  voicePreviewFailureArtifactPath,
  voicePreviewFailureSchema,
  type VoicePreviewFailure,
} from "./catalog/voiceAuditionContracts.js";
import {
  isVoiceCandidatesArtifactPath,
  isVoiceCatalogFailureArtifactPath,
} from "./catalog/voiceCatalogContracts.js";

export async function recordVoicePreviewFailure(input: {
  runId: string;
  voiceId: string;
  error: unknown;
  packageDigest: string;
  startingRevision: string;
}): Promise<never> {
  const failure = previewFailure(input.runId, input.voiceId, input.error);
  const failurePath = voicePreviewFailureArtifactPath(input.voiceId, createId("preview_failure"));
  await writeJsonFile(artifactPath(input.runId, failurePath), failure);
  const mutation = await mutateRun(input.runId, async (current) => {
    const preserveCurrentEvidence =
      current.state !== "PRODUCTION_PACKAGE_GENERATED" ||
      (await voicePreviewDependencyRevision(current, input.voiceId)) !== input.startingRevision ||
      !(await hasMatchingProductionPackage(current, input.packageDigest));
    if (preserveCurrentEvidence) {
      return { run: current, value: true, persist: false };
    }
    return { run: registerRunArtifactPath(current, failurePath), value: false };
  });
  if (!mutation.value) {
    await appendVoicePreviewArtifactWritten(input.runId, failurePath);
  }
  await appendLedgerEvent({
    runId: input.runId,
    type: "ERROR",
    stage: "voice-preview",
    message: failure.message,
    data: {
      code: failure.code,
      provider: failure.provider,
      voiceId: input.voiceId,
      diagnosticRecorded: !mutation.value,
      preservedNewerEvidence: mutation.value,
    },
  });
  throw new SafeExitError(`${failure.message} ${failure.nextAction}`);
}

export async function voicePreviewDependencyRevision(
  run: Awaited<ReturnType<typeof loadRun>>,
  voiceId: string,
): Promise<string> {
  return registeredArtifactSetRevision(run, (relativePath) => {
    return (
      isVoiceCandidatesArtifactPath(relativePath) ||
      isVoiceCatalogFailureArtifactPath(relativePath) ||
      isVoicePreviewAudioArtifactPath(relativePath, voiceId) ||
      isVoicePreviewEvidenceArtifactPath(relativePath, voiceId) ||
      isVoicePreviewFailureArtifactPath(relativePath, voiceId) ||
      isVoiceSelectionArtifactPath(relativePath)
    );
  });
}

export async function appendVoicePreviewArtifactWritten(
  runId: string,
  path: string,
): Promise<void> {
  await appendLedgerEvent({
    runId,
    type: "ARTIFACT_WRITTEN",
    stage: "voice-preview",
    message: `Wrote ${path}.`,
    data: { path },
  });
}

async function hasMatchingProductionPackage(
  run: Awaited<ReturnType<typeof loadRun>>,
  expectedDigest: string,
): Promise<boolean> {
  try {
    return (await verifyProductionPackage(run)).digest === expectedDigest;
  } catch {
    return false;
  }
}

function previewFailure(runId: string, voiceId: string, error: unknown): VoicePreviewFailure {
  const code = previewFailureCode(error);
  const shouldRefreshCatalog = code === "catalog-stale" || code === "metadata-changed";
  const nextAction = shouldRefreshCatalog
    ? "Refresh voice candidates and audition the candidate again."
    : "Inspect redacted diagnostics and retry only after the provider boundary is safe.";
  return voicePreviewFailureSchema.parse({
    schemaVersion: 1,
    runId,
    createdAt: nowIso(),
    provider: "elevenlabs",
    voiceId,
    code,
    message: "ElevenLabs voice preview could not be recorded safely.",
    nextAction,
  });
}

function previewFailureCode(error: unknown): VoicePreviewFailure["code"] {
  if (!(error instanceof SafeExitError)) return "provider-unavailable";
  const message = error.message.toLowerCase();
  if (message.includes("stale")) return "catalog-stale";
  if (message.includes("metadata") || message.includes("catalog changed")) {
    return "metadata-changed";
  }
  if (
    message.includes("redirect") ||
    message.includes("size") ||
    message.includes("audio") ||
    message.includes("url") ||
    message.includes("host")
  ) {
    return "unsafe-preview";
  }
  return "provider-unavailable";
}
