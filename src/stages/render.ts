import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { artifactPath, recordRunArtifact, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { requireApproval, requireState } from "../safeguards/approvalGuard.js";
import { ensureDir } from "../utils/fs.js";
import { shellCommand } from "../utils/shell.js";
import { nowIso } from "../utils/time.js";
import { verifyProductionPackage } from "./production/productionPackageIntegrity.js";
import { renderApprovalRef } from "./render/renderApproval.js";
import {
  buildDraftRenderChapterDraft,
  renderDraftRenderChaptersMarkdown,
} from "./render/renderChapters.js";
import { buildDraftRenderComposition } from "./render/renderComposition.js";
import {
  buildDraftRenderTimeline,
  buildFfmpegArgs,
  buildFfmpegReviewArgs,
  buildFfmpegTimelineInputs,
  draftRenderTargetDuration,
  summarizeDraftRenderTimeline,
} from "./render/renderFfmpegPlan.js";
import { RenderPlan, renderPlanSchema } from "./render/renderPlanSchemas.js";
import { probeDraftRender } from "./render/renderProbe.js";
import { renderDraftReviewMarkdown } from "./render/renderReviewMarkdown.js";
import { buildDraftSubtitleTiming } from "./render/renderSubtitleTiming.js";
import {
  DraftRenderManifest,
  draftRenderChaptersJsonPath,
  draftRenderChaptersMarkdownPath,
  draftRenderManifestPath,
  draftRenderManifestSchema,
  draftRenderPath,
  draftRenderReviewPath,
} from "./renderEvidence.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import { readVoiceoverAudioEvidence, voiceoverAudioPath } from "./voice/voiceoverEvidence.js";

export { buildDraftRenderTimeline, buildFfmpegArgs } from "./render/renderFfmpegPlan.js";

export type RenderDraftOptions = {
  ffmpegBinary?: string;
  ffprobeBinary?: string | false;
  maxDurationSeconds?: number;
};

/**
 * Generates, validates, records, and stores a draft render for a run.
 *
 * @param runId - The run identifier.
 * @param options - Optional overrides for the FFmpeg and FFprobe binaries and maximum render duration.
 * @returns The draft render manifest.
 */
export async function renderDraft(
  runId: string,
  options: RenderDraftOptions = {},
): Promise<DraftRenderManifest> {
  let run = await loadRun(runId);
  let temporaryOutput: string | undefined;
  await requireApproval(run, "render", "render");
  await requireState(run, "RENDER_APPROVED", "render");
  try {
    await verifyProductionPackage(run);
    const renderPlanEvidence = await readRenderPlanEvidence(run);
    if (renderPlanEvidence.status !== "pass") {
      throw new SafeExitError("Draft render requires valid render-plan evidence.");
    }
    if (!renderPlanEvidence.visualManifestDigest) {
      throw new SafeExitError("Draft render requires visual-manifest-bound render-plan evidence.");
    }
    const voiceoverAudio = await readVoiceoverAudioEvidence(run);
    if (voiceoverAudio.status !== "pass") {
      throw new SafeExitError("Draft render requires valid voiceover audio evidence.");
    }
    const approval = run.approvals.find((item) => item.target === "render");
    const currentApprovalRef = renderApprovalRef({
      renderPlanDigest: renderPlanEvidence.digest,
      visualManifestDigest: renderPlanEvidence.visualManifestDigest,
      subtitleDigest: voiceoverAudio.subtitle.sha256,
      subtitleMetadataDigest: voiceoverAudio.subtitle.metadataSha256,
      subtitleTimingMode: voiceoverAudio.subtitle.timingMode,
      voiceMetadataDigest: voiceoverAudio.metadataDigest,
      voiceoverAudioDigest: voiceoverAudio.digest,
      voiceoverMode: voiceoverAudio.mode,
      voiceoverProductionVoiceCandidate: voiceoverAudio.productionVoiceCandidate,
      voiceoverQuality: voiceoverAudio.quality,
    });
    if (approval?.approvedRef !== currentApprovalRef) {
      throw new SafeExitError("Draft render approval is stale for current render inputs.");
    }

    const renderPlan = await readRenderPlan(run.runId);
    const durationSeconds = draftRenderTargetDuration(
      renderPlan,
      voiceoverAudio.durationSeconds,
      options.maxDurationSeconds,
    );
    const timeline = buildDraftRenderTimeline(renderPlan, durationSeconds);
    const timing = summarizeDraftRenderTimeline(timeline);
    const subtitleTiming = buildDraftSubtitleTiming(
      voiceoverAudio.subtitle.sourceDurationSeconds,
      timing.sceneAudioDurationSeconds,
      voiceoverAudio.subtitle.timingMode,
    );
    const ffmpegTimelineInputs = buildFfmpegTimelineInputs(timeline);
    const composition = buildDraftRenderComposition(renderPlan);
    const output = artifactPath(run.runId, draftRenderPath);
    temporaryOutput = path.join(path.dirname(output), `.draft.${process.pid}.${randomUUID()}.mp4`);
    await ensureDir(path.dirname(output));
    await rm(temporaryOutput, { force: true }).catch(() => undefined);
    await rm(output, { force: true }).catch(() => undefined);
    const ffmpegBinary = options.ffmpegBinary ?? "ffmpeg";
    const args = buildFfmpegArgs({
      ffmpegOutputPath: temporaryOutput,
      renderPlan,
      runId: run.runId,
      subtitleArtifactPath: voiceoverAudio.subtitle.path,
      timeline,
      composition,
      durationSeconds,
      subtitleTiming,
    });
    const reviewArgs = buildFfmpegReviewArgs(output);
    await runFfmpeg(ffmpegBinary, args);
    const outputInfo = await stat(temporaryOutput);
    if (outputInfo.size <= 0) {
      throw new SafeExitError("FFmpeg produced an empty draft render output.");
    }
    if (options.ffprobeBinary === false) {
      throw new SafeExitError("Draft render requires ffprobe media validation.");
    }
    const mediaProbe = await probeDraftRender(options.ffprobeBinary ?? "ffprobe", temporaryOutput);
    if (Math.abs(mediaProbe.durationSeconds - timing.totalDurationSeconds) > 0.1) {
      throw new SafeExitError("FFprobe duration does not match the planned draft timeline.");
    }
    await rename(temporaryOutput, output);
    temporaryOutput = undefined;
    const outputBytes = await readFile(output);
    run = await recordRunArtifact(run, "render", draftRenderPath);
    const manifestBase = {
      schemaVersion: 10,
      runId: run.runId,
      createdAt: nowIso(),
      renderPlan: {
        path: "production/render_plan.json",
        digest: renderPlanEvidence.digest,
        visualManifestDigest: renderPlanEvidence.visualManifestDigest,
      },
      voiceoverAudio: {
        path: voiceoverAudioPath,
        digest: voiceoverAudio.digest,
        metadataDigest: voiceoverAudio.metadataDigest,
        mode: voiceoverAudio.mode,
        productionVoiceCandidate: voiceoverAudio.productionVoiceCandidate,
        quality: voiceoverAudio.quality,
      },
      subtitles: voiceoverAudio.subtitle,
      renderApproval: { approvalId: approval.approvalId, approvedRef: currentApprovalRef },
      timeline,
      timing,
      subtitleTiming,
      ffmpegTimelineInputs,
      composition: {
        overlays: composition.overlays.map((overlay) => ({
          role: overlay.asset.role,
          path: overlay.asset.path,
          digest: overlay.asset.digest,
          placement: overlay.placement,
        })),
        reviewChecklist: composition.reviewChecklist,
      },
      output: {
        path: draftRenderPath,
        sha256: createHash("sha256").update(outputBytes).digest("hex"),
        bytes: outputBytes.byteLength,
        durationSeconds: timing.totalDurationSeconds,
      },
      ffmpeg: {
        binary: ffmpegBinary,
        args,
        reviewArgs,
        reviewCommand: shellCommand(ffmpegBinary, reviewArgs),
      },
      mediaProbe,
    };
    const chapterDraft = buildDraftRenderChapterDraft(manifestBase);
    run = await writeRunJson(run, "render", draftRenderChaptersJsonPath, chapterDraft);
    run = await writeRunText(
      run,
      "render",
      draftRenderChaptersMarkdownPath,
      renderDraftRenderChaptersMarkdown(chapterDraft),
    );
    const chapterJsonBytes = await readFile(artifactPath(run.runId, draftRenderChaptersJsonPath));
    const chapterMarkdownBytes = await readFile(
      artifactPath(run.runId, draftRenderChaptersMarkdownPath),
    );
    const manifest = draftRenderManifestSchema.parse({
      ...manifestBase,
      chapterDraft: {
        jsonPath: draftRenderChaptersJsonPath,
        markdownPath: draftRenderChaptersMarkdownPath,
        jsonSha256: createHash("sha256").update(chapterJsonBytes).digest("hex"),
        markdownSha256: createHash("sha256").update(chapterMarkdownBytes).digest("hex"),
      },
    });
    run = await writeRunJson(run, "render", draftRenderManifestPath, manifest);
    run = await writeRunText(
      run,
      "render",
      draftRenderReviewPath,
      renderDraftReviewMarkdown(manifest),
    );
    await setRunState(run, "RENDERED", "render");
    return manifest;
  } catch (error) {
    if (temporaryOutput) {
      await rm(temporaryOutput, { force: true }).catch(() => undefined);
    }
    await appendLedgerEvent({
      runId: run.runId,
      type: "ERROR",
      stage: "render",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function readRenderPlan(runId: string): Promise<RenderPlan> {
  return renderPlanSchema.parse(
    JSON.parse(await readFile(artifactPath(runId, "production/render_plan.json"), "utf8")),
  );
}

async function runFfmpeg(binary: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4_000);
    });
    child.on("error", (error) =>
      reject(new SafeExitError(`FFmpeg failed to start: ${error.message}`)),
    );
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new SafeExitError(`FFmpeg exited with code ${code}: ${stderr.trim()}`));
    });
  });
}
