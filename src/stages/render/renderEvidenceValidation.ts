import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { RunRecord } from "../../core/state.js";
import { pathExists } from "../../utils/fs.js";
import { readJsonFile } from "../../utils/json.js";
import { shellCommand } from "../../utils/shell.js";
import { readRenderPlanEvidence } from "../renderPlan.js";
import {
  soundtrackManifestPath,
  validateSoundtrackManifest,
} from "../soundtrack/soundtrackManifest.js";
import { readVoiceoverAudioEvidence } from "../voice/voiceoverEvidence.js";
import { assertMasteringOutput, audioMasteringEvidenceSchema } from "./audioMastering.js";
import { renderApprovalRefV4 } from "./renderApproval.js";
import {
  draftRenderArtifactPaths,
  draftRenderManifestPath,
  draftRenderManifestSchema,
  draftRenderPath,
  type DraftRenderManifest,
} from "./renderEvidenceContracts.js";
import { buildFfmpegReviewArgs } from "./renderFfmpegPlan.js";
import { buildDraftSubtitleTiming } from "./renderSubtitleTiming.js";
import { summarizeDraftRenderTimeline } from "./renderTimeline.js";

export type ValidatedDraftRenderManifest = { digest: string; manifest: DraftRenderManifest };

export type DraftRenderValidationResult =
  | { status: "missing"; requiredArtifacts: readonly string[] }
  | ({ status: "pass" } & ValidatedDraftRenderManifest)
  | { status: "block"; path: string; message: string };

const draftRenderChapterDraftSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  source: z.strictObject({
    draftRenderPath: z.string().min(1),
    draftRenderSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  chapters: z.array(z.unknown()),
  copyBlock: z.string(),
  operatorNotes: z.array(z.string()),
  blockedActions: z.array(z.string()),
});

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
    return { status: "pass", ...(await readValidatedDraftRenderManifest(run)) };
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
  assertDraftRenderTiming(manifest);
  await assertDraftRenderChapterDrafts(run, manifest);
  await assertDraftRenderInputs(run, manifest);
  if (manifest.schemaVersion === 11) {
    await assertDraftRenderMasteringEvidence(run, manifest);
  }
  return { digest, manifest: trustedReviewManifest(run.runId, manifest) };
}

function assertDraftRenderTiming(manifest: DraftRenderManifest): void {
  const timing = summarizeDraftRenderTimeline(manifest.timeline);
  const timingFields = [
    "introDurationSeconds",
    "sceneAudioDurationSeconds",
    "outroDurationSeconds",
    "totalDurationSeconds",
  ] as const;
  if (
    timingFields.some((field) => Math.abs(timing[field] - manifest.timing[field]) > 0.01) ||
    Math.abs(timing.totalDurationSeconds - manifest.output.durationSeconds) > 0.01
  ) {
    throw new SafeExitError("Draft render timing does not match its timeline.");
  }
  if (Math.abs(manifest.mediaProbe.durationSeconds - manifest.output.durationSeconds) > 0.1) {
    throw new SafeExitError("Draft render probe duration does not match its manifest.");
  }
  const subtitleTiming = buildDraftSubtitleTiming(
    manifest.subtitleTiming.sourceDurationSeconds,
    timing.sceneAudioDurationSeconds,
    manifest.subtitleTiming.timingMode,
  );
  if (
    Math.abs(subtitleTiming.sceneDurationSeconds - manifest.subtitleTiming.sceneDurationSeconds) >
      0.01 ||
    Math.abs(subtitleTiming.timeScale - manifest.subtitleTiming.timeScale) > 0.000001 ||
    manifest.subtitleTiming.timingMode !== manifest.subtitles.timingMode ||
    Math.abs(
      manifest.subtitleTiming.sourceDurationSeconds - manifest.subtitles.sourceDurationSeconds,
    ) > 0.001
  ) {
    throw new SafeExitError("Draft subtitle timing does not match its scene-audio window.");
  }
}

async function assertDraftRenderChapterDrafts(
  run: RunRecord,
  manifest: DraftRenderManifest,
): Promise<void> {
  const json = await readFile(artifactPath(run.runId, manifest.chapterDraft.jsonPath));
  const markdown = await readFile(artifactPath(run.runId, manifest.chapterDraft.markdownPath));
  if (createHash("sha256").update(json).digest("hex") !== manifest.chapterDraft.jsonSha256) {
    throw new SafeExitError("Draft render chapter JSON does not match manifest.");
  }
  if (
    createHash("sha256").update(markdown).digest("hex") !== manifest.chapterDraft.markdownSha256
  ) {
    throw new SafeExitError("Draft render chapter Markdown does not match manifest.");
  }
  const chapterDraft = draftRenderChapterDraftSchema.parse(JSON.parse(json.toString("utf8")));
  if (chapterDraft.runId !== run.runId) {
    throw new SafeExitError("Draft render chapter JSON run id does not match this run.");
  }
  if (chapterDraft.source.draftRenderSha256 !== manifest.output.sha256) {
    throw new SafeExitError("Draft render chapter JSON does not match draft render output.");
  }
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
    manifest.schemaVersion >= 10 &&
    renderPlan.visualManifestDigest !== manifest.renderPlan.visualManifestDigest
  ) {
    throw new SafeExitError("Draft render was generated from stale visual manifest evidence.");
  }
  if (
    voiceoverAudio.status !== "pass" ||
    voiceoverAudio.digest !== manifest.voiceoverAudio.digest ||
    voiceoverAudio.metadataDigest !== manifest.voiceoverAudio.metadataDigest ||
    voiceoverAudio.mode !== manifest.voiceoverAudio.mode ||
    voiceoverAudio.quality !== manifest.voiceoverAudio.quality ||
    voiceoverAudio.productionVoiceCandidate !== manifest.voiceoverAudio.productionVoiceCandidate
  ) {
    throw new SafeExitError("Draft render was generated from stale or missing voiceover audio.");
  }
  if (
    voiceoverAudio.subtitle.path !== manifest.subtitles.path ||
    voiceoverAudio.subtitle.sha256 !== manifest.subtitles.sha256 ||
    voiceoverAudio.subtitle.metadataPath !== manifest.subtitles.metadataPath ||
    voiceoverAudio.subtitle.metadataSha256 !== manifest.subtitles.metadataSha256 ||
    voiceoverAudio.subtitle.timingMode !== manifest.subtitles.timingMode ||
    voiceoverAudio.subtitle.cueCount !== manifest.subtitles.cueCount ||
    Math.abs(
      voiceoverAudio.subtitle.sourceDurationSeconds - manifest.subtitles.sourceDurationSeconds,
    ) > 0.001
  ) {
    throw new SafeExitError("Draft render was generated from stale or missing subtitle evidence.");
  }
  const approval = run.approvals.find((item) => item.target === "render");
  if (
    approval?.approvalId !== manifest.renderApproval.approvalId ||
    approval.approvedRef !== manifest.renderApproval.approvedRef
  ) {
    throw new SafeExitError("Draft render approval record changed after render.");
  }
}

async function assertDraftRenderMasteringEvidence(
  run: RunRecord,
  manifest: Extract<DraftRenderManifest, { schemaVersion: 11 }>,
): Promise<void> {
  if (!run.artifacts.includes(soundtrackManifestPath)) {
    throw new SafeExitError(
      `Draft render soundtrack evidence is not registered: ${soundtrackManifestPath}.`,
    );
  }
  if (!run.artifacts.includes(manifest.mastering.path)) {
    throw new SafeExitError(
      `Draft render mastering evidence is not registered: ${manifest.mastering.path}.`,
    );
  }
  const soundtrackBytes = await readFile(artifactPath(run.runId, soundtrackManifestPath));
  if (
    createHash("sha256").update(soundtrackBytes).digest("hex") !==
    manifest.soundtrack.manifestDigest
  ) {
    throw new SafeExitError("Draft render soundtrack manifest does not match manifest evidence.");
  }
  const soundtrack = await validateSoundtrackManifest(
    JSON.parse(soundtrackBytes.toString("utf8")),
    {
      runId: run.runId,
      readBytes: (relativePath) => {
        if (!run.artifacts.includes(relativePath)) {
          throw new SafeExitError(
            `Draft render soundtrack asset is not registered: ${relativePath}.`,
          );
        }
        return readFile(artifactPath(run.runId, relativePath));
      },
    },
  );
  if (soundtrack.decision?.status !== "approved" || !soundtrack.analysis) {
    throw new SafeExitError("Draft render soundtrack manifest is not approved.");
  }
  const expectedApprovalRef = renderApprovalRefV4({
    renderPlanDigest: manifest.renderPlan.digest,
    visualManifestDigest: manifest.renderPlan.visualManifestDigest,
    subtitleDigest: manifest.subtitles.sha256,
    subtitleMetadataDigest: manifest.subtitles.metadataSha256,
    subtitleTimingMode: manifest.subtitles.timingMode,
    voiceMetadataDigest: manifest.voiceoverAudio.metadataDigest,
    voiceoverAudioDigest: manifest.voiceoverAudio.digest,
    voiceoverMode: manifest.voiceoverAudio.mode,
    voiceoverProductionVoiceCandidate: manifest.voiceoverAudio.productionVoiceCandidate,
    voiceoverQuality: manifest.voiceoverAudio.quality,
    soundtrackManifestDigest: manifest.soundtrack.manifestDigest,
  });
  if (manifest.renderApproval.approvedRef !== expectedApprovalRef) {
    throw new SafeExitError("Draft render approval does not match current v4 input evidence.");
  }
  const masteringBytes = await readFile(artifactPath(run.runId, manifest.mastering.path));
  if (createHash("sha256").update(masteringBytes).digest("hex") !== manifest.mastering.sha256) {
    throw new SafeExitError("Draft render mastering evidence does not match manifest.");
  }
  const mastering = audioMasteringEvidenceSchema.parse(JSON.parse(masteringBytes.toString("utf8")));
  if (
    mastering.source.soundtrackManifestDigest !== manifest.soundtrack.manifestDigest ||
    mastering.source.voiceoverDigest !== manifest.voiceoverAudio.digest ||
    !sameJsonValue(soundtrack.analysis.firstPass, manifest.mastering.firstPass) ||
    !sameJsonValue(mastering.firstPass, manifest.mastering.firstPass) ||
    !sameJsonValue(mastering.outputMeasurement, manifest.mastering.outputMeasurement) ||
    mastering.passed !== manifest.mastering.passed
  ) {
    throw new SafeExitError("Draft render mastering evidence does not match current inputs.");
  }
  assertMasteringOutput(mastering.outputMeasurement);
  if (
    !manifest.mediaProbe.formatName?.split(",").includes(manifest.encoding.container) ||
    manifest.mediaProbe.video.codecName !== manifest.encoding.videoCodec ||
    manifest.mediaProbe.audio.codecName !== manifest.encoding.audioCodec ||
    manifest.mediaProbe.audio.sampleRateHz !== manifest.encoding.audioSampleRateHz ||
    manifest.mediaProbe.audio.channels !== manifest.encoding.audioChannels
  ) {
    throw new SafeExitError("Draft render encoding evidence does not match its media probe.");
  }
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameJsonValue(value, right[index]))
    );
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort((first, second) => first.localeCompare(second));
  const rightKeys = Object.keys(rightRecord).sort((first, second) => first.localeCompare(second));
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) => key === rightKeys[index] && sameJsonValue(leftRecord[key], rightRecord[key]),
    )
  );
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
