import { latestRegisteredArtifactPath } from "../../../core/artifactRegistration.js";
import { readRegisteredArtifactBytesAtProjectRoot } from "../../../core/artifactRevision.js";
import { SafeExitError } from "../../../core/errors.js";
import { loadRun } from "../../../core/runStore.js";
import type { RunRecord } from "../../../core/state.js";
import {
  isVoiceCandidatesArtifactPath,
  isVoiceCatalogFailureArtifactPath,
  voiceCandidatesSchema,
  type VoiceCandidates,
} from "./voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voiceCatalogDigest.js";
import { assertNestedCatalogDigests } from "./voiceCatalogIntegrity.js";

export type VoiceCatalogRun = Pick<RunRecord, "artifacts" | "runId">;

export const maximumVoiceCatalogAgeMs = 60 * 60 * 1_000;

/** Loads the latest validated voice candidate catalog for a run. */
export async function readVoiceCandidates(runId: string): Promise<VoiceCandidates> {
  return (await readVoiceCandidatesWithPath(runId)).catalog;
}

/** Loads and validates the latest voice candidate catalog registered for a run. */
export async function readVoiceCandidatesWithPath(
  runId: string,
): Promise<{ path: string; catalog: VoiceCandidates }> {
  const run = await loadRun(runId);
  return readVoiceCandidatesWithPathAtProjectRoot(process.cwd(), run);
}

/** Loads the latest validated catalog beneath an explicit Producer project root. */
export async function readVoiceCandidatesWithPathAtProjectRoot(
  projectRoot: string,
  run: VoiceCatalogRun,
): Promise<{ path: string; catalog: VoiceCandidates }> {
  const path = requireLatestSuccessfulArtifact(run, {
    success: isVoiceCandidatesArtifactPath,
    failure: isVoiceCatalogFailureArtifactPath,
    missingMessage: "No current voice candidate catalog is registered in run state.",
    failureMessage: "The latest voice catalog refresh failed; refresh it before audition.",
  });
  const bytes = await requireRegisteredBytes(projectRoot, run, path);
  let decoded: unknown;
  try {
    decoded = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new SafeExitError("Voice candidate catalog contains invalid JSON.");
  }
  const parsed = voiceCandidatesSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new SafeExitError("Voice candidate catalog does not match the expected schema.");
  }
  const catalog = parsed.data;
  if (catalog.runId !== run.runId) {
    throw new SafeExitError("Voice candidate catalog belongs to a different run.");
  }
  const { catalogDigest, ...digestInput } = catalog;
  if (canonicalVoiceEvidenceDigest(digestInput) !== catalogDigest) {
    throw new SafeExitError("Voice candidate catalog digest does not match its persisted content.");
  }
  assertNestedCatalogDigests(catalog);
  return { path, catalog };
}

/** Ensures that a voice candidate catalog has a valid and current timestamp. */
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

export function requireLatestSuccessfulArtifact(
  run: VoiceCatalogRun,
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
  if (options.failure(latest)) throw new SafeExitError(options.failureMessage);
  return latest;
}

export async function requireRegisteredBytes(
  projectRoot: string,
  run: VoiceCatalogRun,
  relativePath: string,
): Promise<Buffer> {
  if (!run.artifacts.includes(relativePath)) {
    throw new SafeExitError(`Voice evidence is not registered in run state: ${relativePath}.`);
  }
  const bytes = await readRegisteredArtifactBytesAtProjectRoot(projectRoot, run, relativePath);
  if (!bytes) {
    throw new SafeExitError(`Voice evidence is not registered in run state: ${relativePath}.`);
  }
  return bytes;
}
