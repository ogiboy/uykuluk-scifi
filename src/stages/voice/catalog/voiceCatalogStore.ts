import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { latestRegisteredArtifactPath } from "../../../core/artifactRegistration.js";
import { artifactPath } from "../../../core/artifacts.js";
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
import {
  isVoiceCandidatesArtifactPath,
  isVoiceCatalogFailureArtifactPath,
  voiceCandidatesSchema,
  type VoiceCandidates,
} from "./voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voiceCatalogDigest.js";

export const maximumVoiceCatalogAgeMs = 60 * 60 * 1_000;

/**
 * Loads the latest validated voice candidate catalog for a run.
 *
 * @param runId - The identifier of the run whose catalog should be loaded
 * @returns The validated voice candidate catalog
 */
export async function readVoiceCandidates(runId: string): Promise<VoiceCandidates> {
  return (await readVoiceCandidatesWithPath(runId)).catalog;
}

/**
 * Loads and validates the latest voice candidate catalog registered for a run.
 *
 * @param runId - The run whose voice candidate catalog should be loaded
 * @returns The registered artifact path and validated voice candidate catalog
 * @throws SafeExitError If no catalog is registered, the latest refresh failed, the catalog belongs to another run, or its integrity checks fail
 */
export async function readVoiceCandidatesWithPath(
  runId: string,
): Promise<{ path: string; catalog: VoiceCandidates }> {
  const run = await loadRun(runId);
  const path = requireLatestSuccessfulArtifact(run, {
    success: isVoiceCandidatesArtifactPath,
    failure: isVoiceCatalogFailureArtifactPath,
    missingMessage: "No current voice candidate catalog is registered in run state.",
    failureMessage: "The latest voice catalog refresh failed; refresh it before audition.",
  });
  const catalog = voiceCandidatesSchema.parse(
    JSON.parse(await readFile(artifactPath(runId, path), "utf8")) as unknown,
  );
  if (catalog.runId !== runId) {
    throw new SafeExitError("Voice candidate catalog belongs to a different run.");
  }
  const { catalogDigest, ...digestInput } = catalog;
  if (canonicalVoiceEvidenceDigest(digestInput) !== catalogDigest) {
    throw new SafeExitError("Voice candidate catalog digest does not match its persisted content.");
  }
  assertNestedCatalogDigests(catalog);
  return { path, catalog };
}

/**
 * Ensures that a voice candidate catalog has a valid and current timestamp.
 *
 * @param catalog - The voice candidate catalog to validate
 * @param nowMs - The timestamp used to evaluate catalog freshness
 */
export function requireCurrentVoiceCatalog(
  catalog: VoiceCandidates,
  nowMs: number = Date.now(),
): void {
  const fetchedAt = Date.parse(catalog.fetchedAt);
  if (!Number.isFinite(fetchedAt) || fetchedAt > nowMs + 60_000) {
    throw new SafeExitError("Voice candidate catalog timestamp is invalid.");
  }
  if (nowMs - fetchedAt > maximumVoiceCatalogAgeMs) {
    throw new SafeExitError("Voice candidate catalog is stale; refresh it before audition.");
  }
}

/**
 * Loads validated preview evidence for a voice candidate in a run.
 *
 * @param runId - The run identifier
 * @param voiceId - The voice candidate identifier
 * @returns The validated voice preview evidence
 */
export async function readVoicePreviewEvidence(
  runId: string,
  voiceId: string,
): Promise<VoicePreviewEvidence> {
  return (await readVoicePreviewEvidenceWithPath(runId, voiceId)).evidence;
}

/**
 * Loads and validates the latest voice preview evidence for a candidate.
 *
 * @param runId - The run identifier
 * @param voiceId - The candidate voice identifier
 * @returns The registered evidence artifact path and validated preview evidence
 */
export async function readVoicePreviewEvidenceWithPath(
  runId: string,
  voiceId: string,
): Promise<{ path: string; evidence: VoicePreviewEvidence }> {
  const run = await loadRun(runId);
  const path = await requireLatestVoicePreviewArtifact(run, runId, voiceId);
  const evidence = voicePreviewEvidenceSchema.parse(
    JSON.parse(await readFile(artifactPath(runId, path), "utf8")) as unknown,
  );
  if (evidence.runId !== runId || evidence.candidate.voiceId !== voiceId) {
    throw new SafeExitError("Voice preview evidence belongs to a different run or candidate.");
  }
  if (
    !isVoicePreviewAudioArtifactPath(evidence.output.path, voiceId) ||
    !previewPathsShareGeneration(path, evidence.output.path, evidence.output.format)
  ) {
    throw new SafeExitError("Voice preview evidence points at a different candidate audio path.");
  }
  requireRegisteredArtifact(run, evidence.output.path);
  const { previewDigest, ...digestInput } = evidence;
  if (canonicalVoiceEvidenceDigest(digestInput) !== previewDigest) {
    throw new SafeExitError("Voice preview evidence digest does not match its persisted content.");
  }
  const audio = await readFile(artifactPath(runId, evidence.output.path));
  if (
    audio.byteLength !== evidence.output.bytes ||
    sha256Buffer(audio) !== evidence.output.sha256
  ) {
    throw new SafeExitError("Voice preview audio does not match its evidence digest.");
  }
  return { path, evidence };
}

/**
 * Computes the SHA-256 digest of a byte array.
 *
 * @param value - The bytes to hash
 * @returns The digest as a hexadecimal string
 */
export function sha256Buffer(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Validates the digests, pricing snapshots, subscription status, and candidate identifiers in a voice catalog.
 *
 * @param catalog - The voice catalog to validate
 * @throws SafeExitError If any persisted digest, pricing value, subscription status, or candidate identifier is inconsistent.
 */
function assertNestedCatalogDigests(catalog: VoiceCandidates): void {
  const { metadataDigest: modelDigest, ...modelInput } = catalog.model;
  if (canonicalVoiceEvidenceDigest(modelInput) !== modelDigest) {
    throw new SafeExitError("Voice catalog model digest does not match its persisted content.");
  }
  const { digest: subscriptionDigest, ...subscriptionInput } = catalog.subscription;
  if (canonicalVoiceEvidenceDigest(subscriptionInput) !== subscriptionDigest) {
    throw new SafeExitError(
      "Voice catalog subscription digest does not match its persisted content.",
    );
  }
  const expectedUseStatus =
    catalog.subscription.tier.trim().toLowerCase() === "free"
      ? "blocked-free-tier"
      : "operator-rights-required";
  if (catalog.subscription.productionUseStatus !== expectedUseStatus) {
    throw new SafeExitError("Voice catalog subscription production status is inconsistent.");
  }
  const expectedRate =
    catalog.pricing.baseUsdPerThousandCharacters *
    catalog.pricing.characterCostMultiplier *
    catalog.pricing.costDiscountMultiplier;
  if (Math.abs(expectedRate - catalog.pricing.effectiveUsdPerThousandCharacters) > 1e-12) {
    throw new SafeExitError("Voice catalog pricing snapshot is internally inconsistent.");
  }
  const expectedMaximumRate =
    catalog.pricing.baseUsdPerThousandCharacters *
    catalog.pricing.characterCostMultiplier *
    Math.max(1, catalog.pricing.costDiscountMultiplier);
  if (Math.abs(expectedMaximumRate - catalog.pricing.maximumUsdPerThousandCharacters) > 1e-12) {
    throw new SafeExitError("Voice catalog maximum pricing snapshot is internally inconsistent.");
  }
  const { digest: pricingDigest, ...pricingInput } = catalog.pricing;
  if (canonicalVoiceEvidenceDigest(pricingInput) !== pricingDigest) {
    throw new SafeExitError("Voice catalog pricing digest does not match its persisted content.");
  }
  const seenVoiceIds = new Set<string>();
  for (const candidate of catalog.candidates) {
    if (seenVoiceIds.has(candidate.voiceId)) {
      throw new SafeExitError("Voice candidate catalog contains a duplicate candidate id.");
    }
    seenVoiceIds.add(candidate.voiceId);
    const { metadataDigest, ...candidateInput } = candidate;
    if (canonicalVoiceEvidenceDigest(candidateInput) !== metadataDigest) {
      throw new SafeExitError(
        `Voice candidate metadata digest does not match persisted content: ${candidate.voiceId}.`,
      );
    }
  }
}

/**
 * Ensures that an artifact path is registered in the run state.
 *
 * @param relativePath - The artifact path to verify
 * @throws SafeExitError if the artifact is not registered
 */
function requireRegisteredArtifact(run: Awaited<ReturnType<typeof loadRun>>, relativePath: string) {
  if (!run.artifacts.includes(relativePath)) {
    throw new SafeExitError(`Voice evidence is not registered in run state: ${relativePath}.`);
  }
}

/**
 * Finds the latest registered artifact matching the supplied success or failure criteria.
 *
 * @param run - The loaded run whose registered artifacts are searched
 * @param options - Matching predicates and messages for missing or failed artifacts
 * @returns The path of the latest matching successful artifact
 */
function requireLatestSuccessfulArtifact(
  run: Awaited<ReturnType<typeof loadRun>>,
  options: {
    success: (relativePath: string) => boolean;
    failure: (relativePath: string) => boolean;
    missingMessage: string;
    failureMessage: string;
  },
): string {
  const latest = latestRegisteredArtifactPath(
    run,
    (relativePath) => options.success(relativePath) || options.failure(relativePath),
  );
  if (!latest) throw new SafeExitError(options.missingMessage);
  if (options.failure(latest)) {
    throw new SafeExitError(options.failureMessage);
  }
  return latest;
}

/**
 * Finds the latest registered voice preview evidence artifact for a candidate.
 *
 * @param runId - The run containing the registered artifacts
 * @param voiceId - The candidate whose preview evidence is required
 * @returns The relative path of the latest preview evidence artifact
 */
async function requireLatestVoicePreviewArtifact(
  run: Awaited<ReturnType<typeof loadRun>>,
  runId: string,
  voiceId: string,
): Promise<string> {
  for (let index = run.artifacts.length - 1; index >= 0; index -= 1) {
    const relativePath = run.artifacts[index];
    if (isVoicePreviewEvidenceArtifactPath(relativePath, voiceId)) {
      return relativePath;
    }
    if (relativePath === voicePreviewFailurePath) {
      const failure = await readLegacyVoicePreviewFailure(runId);
      if (failure.runId !== runId) {
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

/**
 * Reads and validates legacy voice preview failure evidence for a run.
 *
 * @param runId - The run identifier whose failure evidence should be read
 * @returns The validated legacy voice preview failure evidence
 */
async function readLegacyVoicePreviewFailure(runId: string) {
  try {
    return voicePreviewFailureSchema.parse(
      JSON.parse(await readFile(artifactPath(runId, voicePreviewFailurePath), "utf8")) as unknown,
    );
  } catch {
    throw new SafeExitError("Legacy voice preview failure evidence is invalid.");
  }
}

/**
 * Determines whether an audio artifact path matches the generation of a preview evidence path.
 *
 * @param evidencePath - The preview evidence artifact path.
 * @param audioPath - The audio artifact path.
 * @param format - The audio format expected for the generation.
 * @returns `true` if `audioPath` matches `evidencePath` with its `.json` suffix replaced by the audio format suffix, `false` otherwise.
 */
function previewPathsShareGeneration(
  evidencePath: string,
  audioPath: string,
  format: "mp3" | "wav",
): boolean {
  return audioPath === evidencePath.replace(/\.json$/u, `.${format}`);
}
