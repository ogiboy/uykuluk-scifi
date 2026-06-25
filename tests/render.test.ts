import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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

    await renderDraft(runId, { ffmpegBinary: ffmpeg, maxDurationSeconds: 1 });

    const run = await loadRun(runId);
    expect(approval).toMatchObject({ target: "render", nextState: "RENDER_APPROVED" });
    expect(run.state).toBe("RENDERED");
    expect(run.artifacts).toEqual(
      expect.arrayContaining([
        "production/render/draft.mp4",
        "production/render/render_manifest.json",
      ]),
    );
    const manifest = await readJsonFile<{
      output: { path: string; sha256: string; bytes: number; durationSeconds: number };
      ffmpeg: { args: string[]; binary: string };
      renderPlan: { digest: string; path: string };
      timeline: Array<{ backgroundAsset: { path: string }; durationSeconds: number }>;
      voiceoverAudio: { digest: string; path: string };
    }>(artifactPath(runId, "production/render/render_manifest.json"));
    expect(manifest.output).toMatchObject({
      path: "production/render/draft.mp4",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      durationSeconds: 1,
    });
    expect(manifest.output.bytes).toBeGreaterThan(0);
    expect(manifest.renderPlan.path).toBe("production/render_plan.json");
    expect(manifest.voiceoverAudio.path).toBe("production/audio/voiceover.wav");
    expect(manifest.timeline.length).toBeGreaterThan(0);
    expect(manifest.timeline[0]).toMatchObject({
      backgroundAsset: { path: "assets/backgrounds/plate_test_1920x1080.jpg" },
      durationSeconds: 1,
    });
    expect(manifest.ffmpeg.binary).toBe(ffmpeg);
    expect(manifest.ffmpeg.args.join("\n")).toContain("production/audio/voiceover.wav");
    expect(manifest.ffmpeg.args.join("\n")).toContain("production/subtitles.srt");
    expect(manifest.ffmpeg.args.join("\n")).toContain(
      "assets/backgrounds/plate_test_1920x1080.jpg",
    );

    const evidence = (await generateEvidenceBundle(runId)) as {
      draftRender: { status: string; path: string; durationSeconds: number };
    };
    expect(evidence.draftRender).toMatchObject({
      status: "pass",
      path: "production/render/draft.mp4",
      durationSeconds: 1,
    });
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

async function enableDeterministicTts(): Promise<void> {
  const config = JSON.parse(await readFile("producer.config.json", "utf8")) as {
    providers: { tts: Record<string, unknown> };
  };
  config.providers.tts = { enabled: true, mode: "deterministic-local" };
  await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function createFakeFfmpeg(): Promise<string> {
  const target = path.join(process.cwd(), "fake-ffmpeg.mjs");
  await writeFile(
    target,
    [
      "#!/usr/bin/env node",
      'import { writeFileSync } from "node:fs";',
      "const output = process.argv.at(-1);",
      'writeFileSync(output, Buffer.from(`fake mp4\\n${process.argv.slice(2).join("\\n")}`));',
    ].join("\n"),
    "utf8",
  );
  await chmod(target, 0o755);
  return target;
}

async function createMinimalRenderAssets(): Promise<void> {
  const files = new Map([
    ["assets/brand/uykulukscifi_channel_logo_square_1024.png", "logo"],
    ["assets/brand/uykulukscifi_watermark_transparent_500.png", "watermark"],
    ["assets/overlays/subtitle_panel_blank_1700x190.png", "subtitle panel"],
    ["assets/overlays/video_lower_third_banner_1920x240.png", "lower third"],
    ["assets/overlays/popup_info_card_900x520.png", "popup card"],
    ["assets/intro/episode_title_card_1920x1080.jpg", "intro"],
    ["assets/outro/youtube_end_screen_1920x1080.jpg", "outro"],
    ["assets/backgrounds/plate_test_1920x1080.jpg", "background"],
    ["assets/icons/icon_fact_check_512.png", "fact icon"],
    ["assets/waveforms/waveform_overlay_thin_panel_transparent_1920x240.png", "waveform"],
  ]);
  for (const [target, content] of files) {
    await mkdir(target.split("/").slice(0, -1).join("/"), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}
