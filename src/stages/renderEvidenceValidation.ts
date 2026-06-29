import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { RunRecord } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { shellCommand } from "../utils/shell.js";
import {
  draftRenderArtifactPaths,
  draftRenderManifestPath,
  draftRenderManifestSchema,
  draftRenderPath,
  type DraftRenderManifest,
} from "./renderEvidenceContracts.js";
import { buildFfmpegReviewArgs } from "./renderFfmpegPlan.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import { readVoiceoverAudioEvidence } from "./voiceoverEvidence.js";

export type ValidatedDraftRenderManifest = {
  digest: string;
  manifest: DraftRenderManifest;
};

export type DraftRenderValidationResult =
  | { status: "missing"; requiredArtifacts: readonly string[] }
  | ({ status: "pass" } & ValidatedDraftRenderManifest)
  | { status: "block"; path: string; message: string };

/**
 * Reads draft render validation state without exposing untrusted persisted commands.
 *
 * @param run - The run record whose draft render artifacts should be checked.
 * @returns Missing, blocked, or pass state with a trusted manifest on pass.
 */
export async function readDraftRenderValidation(
  run: RunRecord,
): Promise<DraftRenderValidationResult> {
  const registered = draftRenderArtifactPaths.some((relativePath) =>
    run.artifacts.includes(relativePath),
  );
  const exists = await Promise.all(
    draftRenderArtifactPaths.map((relativePath) =>
      pathExists(artifactPath(run.runId, relativePath)),
    ),
  );
  if (!registered && exists.every((item) => !item)) {
    return { status: "missing", requiredArtifacts: draftRenderArtifactPaths };
  }
  try {
    return {
      status: "pass",
      ...(await readValidatedDraftRenderManifest(run)),
    };
  } catch (error) {
    return {
      status: "block",
      path: draftRenderPath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Reads and validates the draft render manifest and its bound media artifacts.
 *
 * @param run - The run whose draft render manifest should be validated.
 * @returns The validated manifest plus the current draft MP4 digest.
 */
export async function readValidatedDraftRenderManifest(
  run: RunRecord,
): Promise<ValidatedDraftRenderManifest> {
  await assertDraftRenderArtifacts(run);
  const manifest = draftRenderManifestSchema.parse(
    await readJsonFile(artifactPath(run.runId, draftRenderManifestPath)),
  );
  if (manifest.runId !== run.runId) {
    throw new SafeExitError("Draft render manifest run id does not match this run.");
  }
  const output = await readFile(artifactPath(run.runId, draftRenderPath));
  const digest = createHash("sha256").update(output).digest("hex");
  const info = await stat(artifactPath(run.runId, draftRenderPath));
  if (digest !== manifest.output.sha256 || info.size !== manifest.output.bytes) {
    throw new SafeExitError("Draft render output does not match manifest.");
  }
  await assertDraftRenderInputs(run, manifest);
  return { digest, manifest: trustedReviewManifest(run.runId, manifest) };
}

async function assertDraftRenderInputs(
  run: RunRecord,
  manifest: DraftRenderManifest,
): Promise<void> {
  const renderPlan = await readRenderPlanEvidence(run);
  const voiceoverAudio = await readVoiceoverAudioEvidence(run);
  if (renderPlan.status !== "pass" || renderPlan.digest !== manifest.renderPlan.digest) {
    throw new SafeExitError("Draft render was generated from a stale or missing render plan.");
  }
  if (
    voiceoverAudio.status !== "pass" ||
    voiceoverAudio.digest !== manifest.voiceoverAudio.digest ||
    voiceoverAudio.mode !== manifest.voiceoverAudio.mode ||
    voiceoverAudio.quality !== manifest.voiceoverAudio.quality ||
    voiceoverAudio.productionVoiceCandidate !== manifest.voiceoverAudio.productionVoiceCandidate
  ) {
    throw new SafeExitError("Draft render was generated from stale or missing voiceover audio.");
  }
  const approval = run.approvals.find((item) => item.target === "render");
  if (
    approval?.approvalId !== manifest.renderApproval.approvalId ||
    approval.approvedRef !== manifest.renderApproval.approvedRef
  ) {
    throw new SafeExitError("Draft render approval record changed after render.");
  }
}

function trustedReviewManifest(runId: string, manifest: DraftRenderManifest): DraftRenderManifest {
  const reviewArgs = buildFfmpegReviewArgs(artifactPath(runId, draftRenderPath));
  const reviewCommand = shellCommand(manifest.ffmpeg.binary, reviewArgs);
  if (
    !sameStringArray(manifest.ffmpeg.reviewArgs, reviewArgs) ||
    manifest.ffmpeg.reviewCommand !== reviewCommand
  ) {
    throw new SafeExitError("Draft render review command does not match validated output.");
  }
  return { ...manifest, ffmpeg: { ...manifest.ffmpeg, reviewArgs, reviewCommand } };
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Verifies that all draft render artifacts are registered and present on disk.
 *
 * @param run - The run record whose draft render artifacts are checked.
 */
async function assertDraftRenderArtifacts(run: RunRecord): Promise<void> {
  for (const relativePath of draftRenderArtifactPaths) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Draft render artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(artifactPath(run.runId, relativePath)))) {
      throw new SafeExitError(`Draft render artifact is missing: ${relativePath}.`);
    }
  }
}
