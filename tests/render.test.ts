import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveRender } from "../src/stages/approveRender";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { estimateCost } from "../src/stages/estimate";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { renderDraft } from "../src/stages/render";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { runReadiness } from "../src/stages/readiness";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import {
  createFailingFakeFfprobe,
  createFakeFfmpeg,
  createFakeFfprobe,
  createMinimalRenderAssets,
  enableDeterministicTts,
} from "./renderTestHelpers";

describe("draft render", () => {
  useTempProject();

  it("requires explicit render approval before generating a draft video", async () => {
    const runId = await prepareVoiceoverReadyRun();
    const ffmpeg = await createFakeFfmpeg();
    const evidence = (await generateEvidenceBundle(runId)) as { nextRecommendedCommand: string };

    expect(evidence.nextRecommendedCommand).toBe("pnpm producer approve render --run <run_id>");

    await expect(
      renderDraft(runId, { ffmpegBinary: ffmpeg, maxDurationSeconds: 1 }),
    ).rejects.toThrow(/render approval/i);
    expect(await pathExists(artifactPath(runId, "production/render/draft.mp4"))).toBe(false);
  });

  it("records render approval and writes a draft video manifest through FFmpeg", async () => {
    const runId = await prepareVoiceoverReadyRun();
    const approval = await approveRender(runId);
    const ffmpeg = await createFakeFfmpeg();
    const ffprobe = await createFakeFfprobe();

    await renderDraft(runId, {
      ffmpegBinary: ffmpeg,
      ffprobeBinary: ffprobe,
      maxDurationSeconds: 8,
    });

    const run = await loadRun(runId);
    expect(approval).toMatchObject({ target: "render", nextState: "RENDER_APPROVED" });
    expect(run.state).toBe("RENDERED");
    expect(run.artifacts).toEqual(
      expect.arrayContaining([
        "production/render/draft.mp4",
        "production/render/render_manifest.json",
        "production/render/draft_review.md",
      ]),
    );
    const manifest = await readJsonFile<{
      composition: {
        overlays: Array<{ role: string; path: string; placement: string }>;
        reviewChecklist: string[];
      };
      output: { path: string; sha256: string; bytes: number; durationSeconds: number };
      ffmpeg: { args: string[]; binary: string };
      mediaProbe?: {
        audio: { channels?: number; codecName?: string; sampleRateHz?: number };
        binary: string;
        durationSeconds: number;
        formatName?: string;
        video: { codecName?: string; height: number; width: number };
      };
      renderPlan: { digest: string; path: string };
      schemaVersion: number;
      timeline: Array<{
        backgroundAsset: { path: string };
        durationSeconds: number;
        segment: string;
      }>;
      voiceoverAudio: { digest: string; path: string };
    }>(artifactPath(runId, "production/render/render_manifest.json"));
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.output).toMatchObject({
      path: "production/render/draft.mp4",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      durationSeconds: 8,
    });
    expect(manifest.output.bytes).toBeGreaterThan(0);
    expect(manifest.renderPlan.path).toBe("production/render_plan.json");
    expect(manifest.voiceoverAudio.path).toBe("production/audio/voiceover.wav");
    expect(manifest.timeline.map((item) => item.segment)).toEqual(["intro", "scene", "outro"]);
    expect(manifest.timeline[0]).toMatchObject({
      backgroundAsset: { path: "assets/intro/episode_title_card_1920x1080.jpg" },
      durationSeconds: 2,
    });
    expect(manifest.timeline[1]).toMatchObject({
      backgroundAsset: { path: "assets/backgrounds/plate_test_1920x1080.jpg" },
      durationSeconds: 3,
    });
    expect(manifest.timeline[2]).toMatchObject({
      backgroundAsset: { path: "assets/outro/youtube_end_screen_1920x1080.jpg" },
      durationSeconds: 3,
    });
    expect(manifest.ffmpeg.binary).toBe(ffmpeg);
    expect(manifest.mediaProbe).toEqual({
      audio: { channels: 2, codecName: "aac", sampleRateHz: 48000 },
      binary: ffprobe,
      durationSeconds: 8,
      formatName: "mov,mp4,m4a,3gp,3g2,mj2",
      video: { codecName: "h264", height: 720, width: 1280 },
    });
    expect(manifest.ffmpeg.args.join("\n")).toContain("production/audio/voiceover.wav");
    expect(manifest.ffmpeg.args.join("\n")).toContain("production/subtitles.srt");
    expect(manifest.ffmpeg.args.join("\n")).toContain(
      "assets/backgrounds/plate_test_1920x1080.jpg",
    );
    expect(manifest.ffmpeg.args.join("\n")).toContain(
      "assets/intro/episode_title_card_1920x1080.jpg",
    );
    expect(manifest.ffmpeg.args.join("\n")).toContain(
      "assets/outro/youtube_end_screen_1920x1080.jpg",
    );
    expect(manifest.ffmpeg.args.join("\n")).toContain(
      "assets/overlays/popup_info_card_900x520.png",
    );
    expect(manifest.ffmpeg.args.join("\n")).toContain(
      "assets/waveforms/waveform_overlay_thin_panel_transparent_1920x240.png",
    );
    expect(manifest.composition.overlays.map((overlay) => overlay.role)).toEqual(
      expect.arrayContaining(["watermark", "popup-card", "waveform-overlay"]),
    );
    expect(manifest.composition.reviewChecklist.join(" ")).toContain("private upload");

    const evidence = (await generateEvidenceBundle(runId)) as {
      draftRender: {
        status: string;
        path: string;
        durationSeconds: number;
        overlayRoles: string[];
        timelineSegments: string[];
        reviewPath: string;
        reviewChecklist: string[];
        mediaProbe?: {
          audio: { codecName?: string };
          video: { height: number; width: number };
        };
      };
    };
    expect(evidence.draftRender).toMatchObject({
      status: "pass",
      path: "production/render/draft.mp4",
      durationSeconds: 8,
      overlayRoles: expect.arrayContaining(["popup-card", "waveform-overlay"]),
      timelineSegments: ["intro", "scene", "outro"],
      reviewPath: "production/render/draft_review.md",
      mediaProbe: {
        audio: { codecName: "aac" },
        video: { height: 720, width: 1280 },
      },
    });
    const review = await readFile(artifactPath(runId, "production/render/draft_review.md"), "utf8");
    expect(review).toContain("# Draft Render Review");
    expect(review).toContain("## Media Probe");
    expect(review).toContain("1280x720 h264");
    expect(review).toContain("Local review artifact only");
    expect(review).toContain("assets/intro/episode_title_card_1920x1080.jpg");
    expect(review).toContain("assets/outro/youtube_end_screen_1920x1080.jpg");
    expect(review).toContain("Upload remains disabled");
  });

  it("blocks draft render completion when media probing cannot validate the output", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    const ffmpeg = await createFakeFfmpeg();
    const ffprobe = await createFailingFakeFfprobe();

    await expect(
      renderDraft(runId, { ffmpegBinary: ffmpeg, ffprobeBinary: ffprobe, maxDurationSeconds: 1 }),
    ).rejects.toThrow(/ffprobe exited/i);

    const run = await loadRun(runId);
    expect(run.state).toBe("RENDER_APPROVED");
    expect(run.artifacts).not.toContain("production/render/draft.mp4");
    expect(await pathExists(artifactPath(runId, "production/render/draft.mp4"))).toBe(false);
  });

  it("blocks render approval until voiceover audio evidence exists", async () => {
    const runId = await prepareReadyRunWithoutVoiceover();

    await expect(approveRender(runId)).rejects.toThrow(/voiceover/i);
    expect((await loadRun(runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
  });
});

async function prepareVoiceoverReadyRun(): Promise<string> {
  const runId = await prepareReadyRunWithoutVoiceover();
  await generateVoiceoverAudio(runId);
  return runId;
}

async function prepareReadyRunWithoutVoiceover(): Promise<string> {
  await enableDeterministicTts();
  await createMinimalRenderAssets();
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  await generateRenderPlan(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  const readiness = await runReadiness(runId);
  expect(readiness.passed).toBe(true);
  return runId;
}
