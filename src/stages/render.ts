import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { artifactPath, recordRunArtifact, writeRunJson } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, saveRun, setRunState } from "../core/runStore.js";
import { requireApproval, requireState } from "../safeguards/approvalGuard.js";
import { ensureDir } from "../utils/fs.js";
import { nowIso } from "../utils/time.js";
import { verifyProductionPackage } from "./productionPackageIntegrity.js";
import { renderApprovalRef } from "./renderApproval.js";
import {
  DraftRenderManifest,
  draftRenderManifestPath,
  draftRenderManifestSchema,
  draftRenderPath,
} from "./renderEvidence.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import { RenderPlan, renderPlanSchema } from "./renderPlanSchemas.js";
import { readVoiceoverAudioEvidence, voiceoverAudioPath } from "./voiceoverEvidence.js";

export type RenderDraftOptions = {
  ffmpegBinary?: string;
  maxDurationSeconds?: number;
};

export async function renderDraft(
  runId: string,
  options: RenderDraftOptions = {},
): Promise<DraftRenderManifest> {
  let run = await loadRun(runId);
  await requireApproval(run, "render", "render");
  await requireState(run, "RENDER_APPROVED", "render");
  try {
    await verifyProductionPackage(run);
    const renderPlanEvidence = await readRenderPlanEvidence(run);
    if (renderPlanEvidence.status !== "pass") {
      throw new SafeExitError("Draft render requires valid render-plan evidence.");
    }
    const voiceoverAudio = await readVoiceoverAudioEvidence(run);
    if (voiceoverAudio.status !== "pass") {
      throw new SafeExitError("Draft render requires valid voiceover audio evidence.");
    }
    const approval = run.approvals.find((item) => item.target === "render");
    const currentApprovalRef = renderApprovalRef({
      renderPlanDigest: renderPlanEvidence.digest,
      voiceoverAudioDigest: voiceoverAudio.digest,
    });
    if (approval?.approvedRef !== currentApprovalRef) {
      throw new SafeExitError("Draft render approval is stale for current render inputs.");
    }

    const renderPlan = await readRenderPlan(run.runId);
    const durationSeconds = clampDuration(
      voiceoverAudio.durationSeconds,
      options.maxDurationSeconds,
    );
    const output = artifactPath(run.runId, draftRenderPath);
    const temporaryOutput = path.join(
      path.dirname(output),
      `.draft.${process.pid}.${randomUUID()}.mp4`,
    );
    await ensureDir(path.dirname(output));
    await rm(temporaryOutput, { force: true }).catch(() => undefined);
    await rm(output, { force: true }).catch(() => undefined);
    const ffmpegBinary = options.ffmpegBinary ?? "ffmpeg";
    const args = buildFfmpegArgs({
      ffmpegOutputPath: temporaryOutput,
      renderPlan,
      runId: run.runId,
      durationSeconds,
    });
    await runFfmpeg(ffmpegBinary, args);
    const outputInfo = await stat(temporaryOutput);
    if (outputInfo.size <= 0) {
      throw new SafeExitError("FFmpeg produced an empty draft render output.");
    }
    await rename(temporaryOutput, output);
    const outputBytes = await readFile(output);
    run = await recordRunArtifact(run, "render", draftRenderPath);
    const manifest = draftRenderManifestSchema.parse({
      schemaVersion: 1,
      runId: run.runId,
      createdAt: nowIso(),
      renderPlan: {
        path: "production/render_plan.json",
        digest: renderPlanEvidence.digest,
      },
      voiceoverAudio: {
        path: voiceoverAudioPath,
        digest: voiceoverAudio.digest,
      },
      output: {
        path: draftRenderPath,
        sha256: createHash("sha256").update(outputBytes).digest("hex"),
        bytes: outputBytes.byteLength,
        durationSeconds,
      },
      ffmpeg: {
        binary: ffmpegBinary,
        args,
      },
    });
    run = await writeRunJson(run, "render", draftRenderManifestPath, manifest);
    await saveRun(run);
    await setRunState(run, "RENDERED", "render");
    return manifest;
  } catch (error) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "ERROR",
      stage: "render",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function buildFfmpegArgs(input: {
  durationSeconds: number;
  ffmpegOutputPath: string;
  renderPlan: RenderPlan;
  runId: string;
}): string[] {
  const firstScene = input.renderPlan.scenes[0];
  if (!firstScene) {
    throw new SafeExitError("Draft render requires at least one render-plan scene.");
  }
  const background = path.join(process.cwd(), firstScene.backgroundAsset.path);
  const audio = artifactPath(input.runId, voiceoverAudioPath);
  const subtitles = artifactPath(input.runId, "production/subtitles.srt");
  const watermark = firstScene.overlayAssets.find((asset) => asset.role === "watermark");
  const filter = watermark
    ? [
        `[0:v]scale=1280:720,setsar=1,subtitles=${escapeFilterPath(subtitles)}[base]`,
        `[2:v]scale=120:-1[wm]`,
        "[base][wm]overlay=W-w-24:24[v]",
      ].join(";")
    : `[0:v]scale=1280:720,setsar=1,subtitles=${escapeFilterPath(subtitles)}[v]`;
  const args = ["-y", "-loop", "1", "-i", background, "-i", audio];
  if (watermark) {
    args.push("-i", path.join(process.cwd(), watermark.path));
  }
  args.push(
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    "1:a",
    "-t",
    String(input.durationSeconds),
    "-r",
    "24",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    input.ffmpegOutputPath,
  );
  return args;
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

function clampDuration(actualSeconds: number, maxSeconds?: number): number {
  if (!maxSeconds || maxSeconds <= 0) {
    return roundDuration(actualSeconds);
  }
  return roundDuration(Math.min(actualSeconds, maxSeconds));
}

function roundDuration(seconds: number): number {
  return Math.max(0.1, Math.round(seconds * 100) / 100);
}

const ffmpegFilterEscape = String.fromCodePoint(92);
const escapedFfmpegFilterEscape = `${ffmpegFilterEscape}${ffmpegFilterEscape}`;

function escapeFilterPath(value: string): string {
  return value
    .replaceAll(ffmpegFilterEscape, escapedFfmpegFilterEscape)
    .replaceAll(":", `${ffmpegFilterEscape}:`)
    .replaceAll("'", `${ffmpegFilterEscape}'`);
}
