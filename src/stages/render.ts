import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { artifactPath, recordRunArtifact, writeRunJson, writeRunText } from "../core/artifacts.js";
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
  draftRenderReviewPath,
} from "./renderEvidence.js";
import { buildDraftRenderComposition } from "./renderComposition.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import { renderDraftReviewMarkdown } from "./renderReviewMarkdown.js";
import {
  buildDraftRenderTimeline,
  buildFfmpegArgs,
  clampRenderDuration,
} from "./renderFfmpegPlan.js";
import { probeDraftRender } from "./renderProbe.js";
import { RenderPlan, renderPlanSchema } from "./renderPlanSchemas.js";
import { readVoiceoverAudioEvidence, voiceoverAudioPath } from "./voiceoverEvidence.js";

export { buildDraftRenderTimeline, buildFfmpegArgs } from "./renderFfmpegPlan.js";

export type RenderDraftOptions = {
  ffmpegBinary?: string;
  ffprobeBinary?: string | false;
  maxDurationSeconds?: number;
};

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
    const durationSeconds = clampRenderDuration(
      voiceoverAudio.durationSeconds,
      options.maxDurationSeconds,
    );
    const timeline = buildDraftRenderTimeline(renderPlan, durationSeconds);
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
      timeline,
      composition,
      durationSeconds,
    });
    await runFfmpeg(ffmpegBinary, args);
    const outputInfo = await stat(temporaryOutput);
    if (outputInfo.size <= 0) {
      throw new SafeExitError("FFmpeg produced an empty draft render output.");
    }
    const mediaProbe =
      options.ffprobeBinary === false
        ? undefined
        : await probeDraftRender(options.ffprobeBinary ?? "ffprobe", temporaryOutput);
    await rename(temporaryOutput, output);
    temporaryOutput = undefined;
    const outputBytes = await readFile(output);
    run = await recordRunArtifact(run, "render", draftRenderPath);
    const manifest = draftRenderManifestSchema.parse({
      schemaVersion: 2,
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
      timeline,
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
        durationSeconds,
      },
      ffmpeg: {
        binary: ffmpegBinary,
        args,
      },
      mediaProbe,
    });
    run = await writeRunJson(run, "render", draftRenderManifestPath, manifest);
    run = await writeRunText(
      run,
      "render",
      draftRenderReviewPath,
      renderDraftReviewMarkdown(manifest),
    );
    await saveRun(run);
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
