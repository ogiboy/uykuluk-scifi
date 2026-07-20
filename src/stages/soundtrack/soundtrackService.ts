import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { readRegisteredArtifactBytes } from "../../core/artifactRevision.js";
import { captureRunArtifactRollback } from "../../core/artifactRollback.js";
import { writeRunBinary, writeRunJson, writeRunText } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { queueRunLedgerEvent, reconcileRunLedgerOutbox } from "../../core/runLedgerOutbox.js";
import { mutateRun } from "../../core/runStore.js";
import type { RunRecord } from "../../core/state.js";
import { requireState } from "../../safeguards/approvalGuard.js";
import { nowIso } from "../../utils/time.js";
import { firstPassLoudnormFilter, parseLoudnormMeasurement } from "../render/audioMastering.js";
import { buildSoundtrackAnalysisArgs } from "../render/audioMasteringExecution.js";
import { buildRenderAudioGraph } from "../render/renderAudioMix.js";
import { readRenderPlanEvidence } from "../render/renderPlanEvidence.js";
import { renderPlanSchema, type RenderPlan } from "../render/renderPlanSchemas.js";
import {
  buildDraftRenderTimeline,
  draftRenderTargetDuration,
  summarizeDraftRenderTimeline,
} from "../render/renderTimeline.js";
import { soundtrackRenderInputs } from "../render/soundtrackRenderInputs.js";
import { readVoiceoverAudioEvidence, voiceoverAudioPath } from "../voice/voiceoverEvidence.js";
import { probeSoundtrackAudio, type SoundtrackAudioProbe } from "./soundtrackAudioProbe.js";
import {
  renderSoundtrackReview,
  soundtrackAssetDigest,
  soundtrackAssetPath,
  soundtrackManifestPath,
  soundtrackManifestSchema,
  soundtrackMasteringProfile,
  soundtrackReviewPath,
  validateSoundtrackManifest,
  validateSoundtrackManifestForRun,
  type SoundtrackAsset,
  type SoundtrackDecision,
  type SoundtrackManifest,
} from "./soundtrackManifest.js";

const stage = "soundtrack";
const maxImportedAudioBytes = 50 * 1024 * 1024;
const analysisTimeoutMs = 30 * 60_000;
const analysisStderrLimitBytes = 128_000;

export type SoundtrackManifestEvidence = Readonly<{ manifest: SoundtrackManifest; digest: string }>;
export type SoundtrackFfmpegRunner = (
  input: Readonly<{ args: readonly string[]; timeoutMs: number; maxStderrBytes: number }>,
) => Promise<Readonly<{ stderr: string }>>;

type Expectation = Readonly<{ expectedManifestDigest: string; expectedRevision: number }>;

/** Creates the initial voice-only soundtrack manifest from current reviewed voice evidence. */
export async function prepareVoiceOnlySoundtrack(
  input: Readonly<{ runId: string }>,
): Promise<SoundtrackManifestEvidence> {
  const result = await mutateRun(input.runId, async (run, transaction) => {
    await requireState(run, "READY_FOR_MANUAL_PRODUCTION", stage);
    if (run.artifacts.includes(soundtrackManifestPath)) {
      throw new SafeExitError(
        "Soundtrack manifest already exists; prepare cannot overwrite revision history.",
      );
    }
    const voiceover = await requireCurrentVoiceover(run);
    transaction.onRollback(
      await captureRunArtifactRollback(run.runId, stage, [
        soundtrackManifestPath,
        soundtrackReviewPath,
      ]),
    );
    const now = nowIso();
    const manifest = soundtrackManifestSchema.parse({
      schemaVersion: 1,
      runId: run.runId,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      voiceover,
      mode: "voice-only",
      profile: soundtrackMasteringProfile,
      assets: [],
      sfx: [],
    });
    let updatedRun = await writeRunJson(run, stage, soundtrackManifestPath, manifest);
    updatedRun = await writeRunText(
      updatedRun,
      stage,
      soundtrackReviewPath,
      renderSoundtrackReview(manifest),
    );
    return { run: updatedRun, value: manifestEvidence(manifest) };
  });
  return result.value;
}

/** Imports one bounded local audio file after exact manifest expectation and FFprobe validation. */
export async function importSoundtrackAudio(
  input: Readonly<{
    runId: string;
    assetId: string;
    role: "music" | "sfx";
    sourcePath: string;
    provenance: SoundtrackAsset["provenance"];
    ffprobeBinary?: string;
    probe?: (sourcePath: string) => Promise<SoundtrackAudioProbe>;
  }> &
    Expectation,
): Promise<SoundtrackManifestEvidence> {
  const source = await readBoundedImport(input.sourcePath);
  const mediaProbe = await (
    input.probe ??
    ((sourcePath) => probeSoundtrackAudio(input.ffprobeBinary ?? "ffprobe", sourcePath))
  )(input.sourcePath);
  const container = inferContainer(input.sourcePath);
  const assetPath = soundtrackAssetPath(input.assetId, container);
  const result = await mutateRun(input.runId, async (run, transaction) => {
    await requireState(run, "READY_FOR_MANUAL_PRODUCTION", stage);
    const current = await loadSoundtrackManifest(run);
    assertExpectation(current, input);
    if (current.manifest.assets.some((asset) => asset.assetId === input.assetId)) {
      throw new SafeExitError(
        `Soundtrack asset ${input.assetId} already exists; use a new asset id.`,
      );
    }
    transaction.onRollback(
      await captureRunArtifactRollback(run.runId, stage, [
        assetPath,
        soundtrackManifestPath,
        soundtrackReviewPath,
      ]),
    );
    const asset: SoundtrackAsset = {
      assetId: input.assetId,
      role: input.role,
      path: assetPath,
      digest: soundtrackAssetDigest(source),
      media: { bytes: source.byteLength, container, ...mediaProbe },
      provenance: input.provenance,
    };
    const manifest = reviseManifest(current.manifest, {
      assets: [...current.manifest.assets, asset],
    });
    let updatedRun = await writeRunBinary(run, stage, asset.path, source);
    updatedRun = await persistSoundtrackManifest(updatedRun, manifest);
    return { run: updatedRun, value: manifestEvidence(manifest) };
  });
  return result.value;
}

/** Configures the selected music bed and timed SFX cues, invalidating prior analysis and decision. */
export async function configureSoundtrackMix(
  input: Readonly<{
    runId: string;
    music?: NonNullable<SoundtrackManifest["music"]>;
    sfx: SoundtrackManifest["sfx"];
  }> &
    Expectation,
): Promise<SoundtrackManifestEvidence> {
  const result = await mutateRun(input.runId, async (run, transaction) => {
    await requireState(run, "READY_FOR_MANUAL_PRODUCTION", stage);
    const current = await loadSoundtrackManifest(run);
    assertExpectation(current, input);
    transaction.onRollback(
      await captureRunArtifactRollback(run.runId, stage, [
        soundtrackManifestPath,
        soundtrackReviewPath,
      ]),
    );
    const manifest = reviseManifest(current.manifest, {
      mode: input.music || input.sfx.length > 0 ? "mixed" : "voice-only",
      music: input.music,
      sfx: input.sfx,
    });
    const updatedRun = await persistSoundtrackManifest(run, manifest);
    return { run: updatedRun, value: manifestEvidence(manifest) };
  });
  return result.value;
}

/** Runs deterministic loudnorm pass-one analysis through a caller-injected bounded FFmpeg seam. */
export async function analyzeSoundtrackLoudness(
  input: Readonly<{ runId: string; ffmpeg: SoundtrackFfmpegRunner }> & Expectation,
): Promise<SoundtrackManifestEvidence> {
  const run = await mutateRun(input.runId, async (current) => ({
    run: current,
    value: current,
    persist: false,
  }));
  await requireState(run.value, "READY_FOR_MANUAL_PRODUCTION", stage);
  const current = await loadSoundtrackManifest(run.value);
  assertExpectation(current, input);
  await requireCurrentVoiceover(run.value, current.manifest);
  await validateRegisteredSoundtrackAssets(run.value, current.manifest);
  const graph = await buildSoundtrackAnalysisGraph(run.value, current.manifest);
  const ffmpeg = await input.ffmpeg({
    args: buildSoundtrackAnalysisArgs(graph),
    timeoutMs: analysisTimeoutMs,
    maxStderrBytes: analysisStderrLimitBytes,
  });
  const firstPass = parseLoudnormMeasurement(ffmpeg.stderr.slice(-analysisStderrLimitBytes));
  const result = await mutateRun(input.runId, async (latest, transaction) => {
    await requireState(latest, "READY_FOR_MANUAL_PRODUCTION", stage);
    const manifest = await loadSoundtrackManifest(latest);
    assertExpectation(manifest, input);
    await requireCurrentVoiceover(latest, manifest.manifest);
    transaction.onRollback(
      await captureRunArtifactRollback(latest.runId, stage, [
        soundtrackManifestPath,
        soundtrackReviewPath,
      ]),
    );
    const updated = soundtrackManifestSchema.parse({
      ...manifest.manifest,
      updatedAt: nowIso(),
      analysis: {
        algorithm: "ffmpeg-loudnorm-two-pass-v1",
        measuredAt: nowIso(),
        normalizationMode: "linear",
        firstPass,
      },
      decision: undefined,
    });
    const updatedRun = await persistSoundtrackManifest(latest, updated);
    return { run: updatedRun, value: manifestEvidence(updated) };
  });
  return result.value;
}

/** Records an operator decision explicitly bound to the current soundtrack revision. */
export async function decideSoundtrack(
  input: Readonly<{
    runId: string;
    status: SoundtrackDecision["status"];
    reviewedBy: string;
    notes: string;
  }> &
    Expectation,
): Promise<SoundtrackManifestEvidence> {
  await reconcileRunLedgerOutbox(input.runId);
  const result = await mutateRun(input.runId, async (run, transaction) => {
    await requireState(run, "READY_FOR_MANUAL_PRODUCTION", stage);
    const current = await loadSoundtrackManifest(run);
    assertExpectation(current, input);
    await requireCurrentVoiceover(run, current.manifest);
    await validateRegisteredSoundtrackAssets(run, current.manifest);
    if (input.status === "approved" && !current.manifest.analysis) {
      throw new SafeExitError("Approved soundtrack decision requires current loudness analysis.");
    }
    transaction.onRollback(
      await captureRunArtifactRollback(run.runId, stage, [
        soundtrackManifestPath,
        soundtrackReviewPath,
      ]),
    );
    const manifest = soundtrackManifestSchema.parse({
      ...current.manifest,
      updatedAt: nowIso(),
      decision: {
        revision: current.manifest.revision,
        status: input.status,
        reviewedBy: input.reviewedBy,
        notes: input.notes,
        decidedAt: nowIso(),
      },
    });
    let updatedRun = await persistSoundtrackManifest(run, manifest);
    updatedRun = queueRunLedgerEvent(updatedRun, {
      type: "REVIEW_DECISION_RECORDED",
      stage,
      message: `Soundtrack revision ${manifest.revision} ${input.status}.`,
      data: {
        revision: manifest.revision,
        status: input.status,
        manifestDigest: manifestEvidence(manifest).digest,
      },
    });
    return { run: updatedRun, value: manifestEvidence(manifest) };
  });
  await reconcileRunLedgerOutbox(input.runId);
  return result.value;
}

/** Loads current soundtrack evidence and rejects missing, rejected, stale, or tampered approval. */
export async function requireApprovedSoundtrackManifest(
  run: RunRecord,
): Promise<SoundtrackManifestEvidence> {
  const evidence = await loadSoundtrackManifest(run);
  await validateRegisteredSoundtrackAssets(run, evidence.manifest);
  await requireCurrentVoiceover(run, evidence.manifest);
  if (
    evidence.manifest.decision?.status !== "approved" ||
    evidence.manifest.decision.revision !== evidence.manifest.revision
  ) {
    throw new SafeExitError("Soundtrack manifest is not currently approved.");
  }
  if (!evidence.manifest.analysis)
    throw new SafeExitError("Approved soundtrack manifest is missing loudness analysis.");
  return evidence;
}

async function validateRegisteredSoundtrackAssets(
  run: RunRecord,
  manifest: SoundtrackManifest,
): Promise<void> {
  await validateSoundtrackManifest(manifest, {
    runId: run.runId,
    readBytes: async (relativePath) => {
      const bytes = await readRegisteredArtifactBytes(run, relativePath);
      if (!bytes) throw new SafeExitError(`Soundtrack asset is missing: ${relativePath}.`);
      return bytes;
    },
  });
}

async function loadSoundtrackManifest(run: RunRecord): Promise<SoundtrackManifestEvidence> {
  const bytes = await readRegisteredArtifactBytes(run, soundtrackManifestPath);
  if (!bytes) throw new SafeExitError("Soundtrack manifest is missing.");
  try {
    return {
      manifest: validateSoundtrackManifestForBytes(bytes, run.runId),
      digest: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch (error) {
    if (error instanceof SafeExitError) throw error;
    throw new SafeExitError(
      `Soundtrack manifest is malformed or invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function validateSoundtrackManifestForBytes(bytes: Buffer, runId: string): SoundtrackManifest {
  return validateSoundtrackManifestForRun(JSON.parse(bytes.toString("utf8")) as unknown, runId);
}

function assertExpectation(current: SoundtrackManifestEvidence, expected: Expectation): void {
  if (
    current.digest !== expected.expectedManifestDigest ||
    current.manifest.revision !== expected.expectedRevision
  ) {
    throw new SafeExitError("Soundtrack manifest does not match the expected digest and revision.");
  }
}

function reviseManifest(
  manifest: SoundtrackManifest,
  change: Partial<SoundtrackManifest>,
): SoundtrackManifest {
  return soundtrackManifestSchema.parse({
    ...manifest,
    ...change,
    revision: manifest.revision + 1,
    updatedAt: nowIso(),
    analysis: undefined,
    decision: undefined,
  });
}

async function persistSoundtrackManifest(
  run: RunRecord,
  manifest: SoundtrackManifest,
): Promise<RunRecord> {
  let updated = await writeRunJson(run, stage, soundtrackManifestPath, manifest);
  updated = await writeRunText(
    updated,
    stage,
    soundtrackReviewPath,
    renderSoundtrackReview(manifest),
  );
  return updated;
}

async function requireCurrentVoiceover(
  run: RunRecord,
  manifest?: SoundtrackManifest,
): Promise<SoundtrackManifest["voiceover"]> {
  const evidence = await readVoiceoverAudioEvidence(run);
  if (evidence.status !== "pass") {
    throw new SafeExitError(
      `Current reviewed voice evidence is required: ${evidence.status === "block" ? evidence.message : "voiceover artifacts are missing"}.`,
    );
  }
  const voiceover = {
    path: voiceoverAudioPath,
    digest: evidence.digest,
    metadataDigest: evidence.metadataDigest,
    durationSeconds: evidence.durationSeconds,
  } as const;
  if (
    manifest &&
    (manifest.voiceover.digest !== voiceover.digest ||
      manifest.voiceover.metadataDigest !== voiceover.metadataDigest ||
      manifest.voiceover.durationSeconds !== voiceover.durationSeconds)
  ) {
    throw new SafeExitError("Soundtrack manifest is stale for current reviewed voice evidence.");
  }
  return voiceover;
}

/** Builds analysis input from the exact render timeline and current configured soundtrack assets. */
async function buildSoundtrackAnalysisGraph(run: RunRecord, manifest: SoundtrackManifest) {
  const evidence = await readRenderPlanEvidence(run);
  if (evidence.status !== "pass") {
    throw new SafeExitError(
      `Soundtrack analysis requires current render-plan evidence: ${evidence.status === "block" ? evidence.message : "render plan artifacts are missing"}.`,
    );
  }
  const bytes = await readRegisteredArtifactBytes(run, "production/render_plan.json");
  if (!bytes) throw new SafeExitError("Soundtrack analysis render plan is missing.");
  let renderPlan: RenderPlan;
  try {
    renderPlan = renderPlanSchema.parse(JSON.parse(bytes.toString("utf8")) as unknown);
  } catch (error) {
    throw new SafeExitError(
      `Soundtrack analysis render plan is malformed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const duration = draftRenderTargetDuration(renderPlan, manifest.voiceover.durationSeconds);
  const timeline = buildDraftRenderTimeline(renderPlan, duration);
  return buildRenderAudioGraph({
    firstAudioInputIndex: 0,
    masteringFilter: firstPassLoudnormFilter(),
    runId: run.runId,
    soundtrack: soundtrackRenderInputs(manifest),
    timing: summarizeDraftRenderTimeline(timeline),
  });
}

async function readBoundedImport(sourcePath: string): Promise<Buffer> {
  const info = await stat(sourcePath);
  if (!info.isFile()) throw new SafeExitError("Soundtrack import must be a regular local file.");
  if (info.size <= 0 || info.size > maxImportedAudioBytes)
    throw new SafeExitError(
      `Soundtrack import must be between 1 byte and ${maxImportedAudioBytes} bytes.`,
    );
  const bytes = await readFile(sourcePath);
  if (bytes.byteLength !== info.size)
    throw new SafeExitError("Soundtrack import changed while it was being read.");
  return bytes;
}

function inferContainer(sourcePath: string): SoundtrackAsset["media"]["container"] {
  const extension = path.extname(sourcePath).slice(1).toLowerCase();
  if (["wav", "mp3", "m4a", "ogg", "flac"].includes(extension))
    return extension as SoundtrackAsset["media"]["container"];
  throw new SafeExitError("Soundtrack import must use a supported audio extension.");
}

function manifestEvidence(manifest: SoundtrackManifest): SoundtrackManifestEvidence {
  return {
    manifest,
    digest: createHash("sha256")
      .update(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
      .digest("hex"),
  };
}
