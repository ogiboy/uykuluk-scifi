import { loadConfig } from "../config/config.js";
import { registerRunArtifactPath } from "../core/artifactRegistration.js";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, mutateRun } from "../core/runStore.js";
import { requireState } from "../safeguards/approvalGuard.js";
import { writeBinaryFile } from "../utils/fs.js";
import { writeJsonFile } from "../utils/json.js";
import { createId } from "../utils/time.js";
import { verifyProductionPackage } from "./production/productionPackageIntegrity.js";
import {
  voicePreviewAudioPath,
  voicePreviewEvidencePath,
  voicePreviewEvidenceSchema,
  type VoicePreviewEvidence,
} from "./voice/catalog/voiceAuditionContracts.js";
import { voiceIdSchema } from "./voice/catalog/voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voice/catalog/voiceCatalogDigest.js";
import {
  requireCatalogCandidate,
  requireElevenLabsCatalogConfig,
} from "./voice/catalog/voiceCatalogGuards.js";
import type { VoicePreviewProvider } from "./voice/catalog/voiceCatalogProvider.js";
import {
  readVoiceCandidatesWithPath,
  requireCurrentVoiceCatalog,
  sha256Buffer,
} from "./voice/catalog/voiceCatalogStore.js";
import { ElevenLabsVoicePreviewProvider } from "./voice/providers/elevenLabsVoicePreviewProvider.js";
import {
  appendVoicePreviewArtifactWritten,
  recordVoicePreviewFailure,
  voicePreviewDependencyRevision,
} from "./voice/voicePreviewPersistence.js";

type Options = { provider?: VoicePreviewProvider };

/** Downloads one provider-owned preview into bounded, redacted run evidence. */
export async function generateVoicePreview(
  runId: string,
  voiceId: string,
  options: Options = {},
): Promise<VoicePreviewEvidence> {
  const parsedVoiceId = voiceIdSchema.safeParse(voiceId);
  if (!parsedVoiceId.success) {
    throw new SafeExitError("Voice preview requires a valid persisted candidate id.");
  }
  const safeVoiceId = parsedVoiceId.data;
  const config = await loadConfig();
  const run = await loadRun(runId);
  await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "voice-preview");
  const packageSnapshot = await verifyProductionPackage(run);
  const startingPreviewRevision = await voicePreviewDependencyRevision(run, safeVoiceId);
  const provider = options.provider ?? new ElevenLabsVoicePreviewProvider();

  let catalogRecord: Awaited<ReturnType<typeof readVoiceCandidatesWithPath>>;
  let candidate: ReturnType<typeof requireCatalogCandidate>;
  let result: Awaited<ReturnType<VoicePreviewProvider["fetchPreview"]>>;
  try {
    catalogRecord = await readVoiceCandidatesWithPath(runId);
    const catalog = catalogRecord.catalog;
    requireCurrentVoiceCatalog(catalog);
    const settings = requireElevenLabsCatalogConfig(config, catalog);
    candidate = requireCatalogCandidate(catalog, safeVoiceId);
    provider.assertReady();
    result = await provider.fetchPreview({
      candidate,
      languageCode: settings.languageCode,
      modelId: settings.modelId,
      subscription: {
        tier: catalog.subscription.tier,
        status: catalog.subscription.status,
        hasOpenInvoices: catalog.subscription.hasOpenInvoices,
      },
    });
    assertPreviewResult(candidate, result);
  } catch (error) {
    return recordVoicePreviewFailure({
      runId,
      voiceId: safeVoiceId,
      error,
      packageDigest: packageSnapshot.digest,
      startingRevision: startingPreviewRevision,
    });
  }

  const catalog = catalogRecord.catalog;
  const previewId = createId("preview");
  const outputPath = voicePreviewAudioPath(safeVoiceId, previewId, result.format);
  const evidencePath = voicePreviewEvidencePath(safeVoiceId, previewId);
  const evidenceInput = {
    schemaVersion: 1 as const,
    runId,
    createdAt: result.fetchedAt,
    provider: "elevenlabs" as const,
    catalogDigest: catalog.catalogDigest,
    candidate: { voiceId: safeVoiceId, metadataDigest: candidate.metadataDigest },
    model: { modelId: catalog.model.modelId, metadataDigest: catalog.model.metadataDigest },
    source: {
      sourceClass: result.sourceClass,
      urlSha256: result.sourceUrlSha256,
      requestIdHashes: Array.from(new Set(result.requestIdHashes)).slice(0, 4),
    },
    output: {
      path: outputPath,
      sha256: sha256Buffer(result.audio),
      bytes: result.audio.byteLength,
      format: result.format,
      mimeType: result.format === "mp3" ? ("audio/mpeg" as const) : ("audio/wav" as const),
    },
  };
  const evidence = voicePreviewEvidenceSchema.parse({
    ...evidenceInput,
    previewDigest: canonicalVoiceEvidenceDigest(evidenceInput),
  });
  await writeBinaryFile(artifactPath(runId, outputPath), result.audio);
  await writeJsonFile(artifactPath(runId, evidencePath), evidence);
  await mutateRun(runId, async (current) => {
    await requireState(current, "PRODUCTION_PACKAGE_GENERATED", "voice-preview");
    const currentPackage = await verifyProductionPackage(current);
    if (currentPackage.digest !== packageSnapshot.digest) {
      throw new SafeExitError(
        "Production package changed while the voice preview request was in flight.",
      );
    }
    const currentCatalog = await readVoiceCandidatesWithPath(runId);
    requireCurrentVoiceCatalog(currentCatalog.catalog);
    if (
      currentCatalog.path !== catalogRecord.path ||
      currentCatalog.catalog.catalogDigest !== catalog.catalogDigest
    ) {
      throw new SafeExitError("Voice catalog changed while the preview request was in flight.");
    }
    if ((await voicePreviewDependencyRevision(current, safeVoiceId)) !== startingPreviewRevision) {
      throw new SafeExitError("Voice preview evidence changed while the request was in flight.");
    }
    const withAudio = registerRunArtifactPath(current, outputPath);
    return { run: registerRunArtifactPath(withAudio, evidencePath), value: undefined };
  });
  await appendVoicePreviewArtifactWritten(runId, outputPath);
  await appendVoicePreviewArtifactWritten(runId, evidencePath);
  await appendLedgerEvent({
    runId,
    type: "GUARD_PASSED",
    stage: "voice-preview",
    message: "Bounded ElevenLabs voice preview recorded for local audition.",
    data: {
      voiceId: safeVoiceId,
      evidencePath,
      previewDigest: evidence.previewDigest,
      audioSha256: evidence.output.sha256,
      bytes: evidence.output.bytes,
    },
  });
  return evidence;
}

function assertPreviewResult(
  candidate: { metadataDigest: string; preview: { urlSha256?: string } },
  result: Awaited<ReturnType<VoicePreviewProvider["fetchPreview"]>>,
): void {
  if (
    result.voiceMetadataDigest !== candidate.metadataDigest ||
    result.sourceUrlSha256 !== candidate.preview.urlSha256
  ) {
    throw new SafeExitError("ElevenLabs voice preview metadata changed after catalog generation.");
  }
}
