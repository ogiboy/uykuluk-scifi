import { mkdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { voiceoverAudioMetaSchema } from "../src/stages/voiceoverEvidence";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

describe("voiceover audio", () => {
  useTempProject();

  it("generates local deterministic WAV audio after readiness and render planning", async () => {
    await enableDeterministicTts();
    const runId = await prepareReadyRun({ renderPlan: true });

    await generateVoiceoverAudio(runId);

    const run = await loadRun(runId);
    expect(run.state).toBe("READY_FOR_MANUAL_PRODUCTION");
    expect(run.artifacts).toEqual(
      expect.arrayContaining([
        "production/audio/voiceover.wav",
        "production/audio/voiceover.meta.json",
        "production/audio/voiceover_review.md",
      ]),
    );
    const wav = await readFile(artifactPath(runId, "production/audio/voiceover.wav"));
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");

    const meta = await readJsonFile<{
      mode: string;
      runId: string;
      output: { durationSeconds: number; path: string; sha256: string };
      renderPlan: { path: string; digest: string };
      source: { path: string; sha256: string; wordCount: number };
    }>(artifactPath(runId, "production/audio/voiceover.meta.json"));
    expect(meta).toMatchObject({
      mode: "deterministic-local",
      runId,
      output: {
        path: "production/audio/voiceover.wav",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      renderPlan: {
        path: "production/render_plan.json",
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      source: { path: "production/voiceover.txt", sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(meta.output.durationSeconds).toBeGreaterThan(0);
    expect(meta.source.wordCount).toBeGreaterThan(0);
    const review = await readFile(
      artifactPath(runId, "production/audio/voiceover_review.md"),
      "utf8",
    );
    expect(review).toContain("# Voiceover Review");
    expect(review).toContain("Deterministic reference audio is for timing only");
    expect(review).toContain("production/audio/voiceover.wav");
    expect(review).toContain(`runs/${runId}/production/audio/voiceover.wav`);
    expect(review).toContain("Render approval scope");
    expect(review).toContain("timing-draft-only");
    expect(review).toContain("Render approval command");
    expect(review).toContain(
      "render approval has not been granted from audio file existence alone",
    );
    expect(review).toContain("## Operator Decision");
    expect(review).toContain(
      `pnpm producer approve render --run ${runId}\` only for a local timing draft`,
    );
    expect(review).toContain(`pnpm producer render --run ${runId}`);
    expect(review).toContain(
      "Private upload, scheduled publish, public publish, and paid provider execution remain unavailable",
    );

    const evidence = (await generateEvidenceBundle(runId)) as {
      blockedActions: string[];
      nextRecommendedCommand: string;
      voiceoverAudio: {
        productionVoiceCandidate: boolean;
        quality: string;
        status: string;
        path: string;
        durationSeconds: number;
        reviewPath: string;
      };
    };
    expect(evidence.voiceoverAudio).toMatchObject({
      status: "pass",
      path: "production/audio/voiceover.wav",
      durationSeconds: meta.output.durationSeconds,
      productionVoiceCandidate: false,
      quality: "deterministic-local-reference",
      reviewPath: "production/audio/voiceover_review.md",
    });
    expect(evidence.blockedActions).not.toContain(
      "Production voice candidate is not available; deterministic local audio is timing/reference only until reviewed local Piper audio exists.",
    );
    expect(evidence.nextRecommendedCommand).toBe(`pnpm producer review voice --run ${runId}`);
    const postVoiceReadiness = await runReadiness(runId);
    expect(postVoiceReadiness.passed).toBe(true);
    expect(
      postVoiceReadiness.checks.find((check) => check.name === "voiceover audio available"),
    ).toMatchObject({
      status: "warn",
      message: expect.stringContaining("timing/reference audio only"),
      nextAction: `pnpm producer review voice --run ${runId}`,
    });
  });

  it("blocks before readiness has passed", async () => {
    await enableDeterministicTts();
    await createMinimalRenderAssets();
    const runId = await preparePackagedRun();
    await generateRenderPlan(runId);

    await expect(generateVoiceoverAudio(runId)).rejects.toThrow(/ready_for_manual_production/i);
    expect(await pathExists(artifactPath(runId, "production/audio/voiceover.wav"))).toBe(false);
  });

  it("blocks when TTS remains disabled", async () => {
    const runId = await prepareReadyRun({ renderPlan: true });

    await expect(generateVoiceoverAudio(runId)).rejects.toThrow(/voice\/tts is disabled/i);
    expect(await pathExists(artifactPath(runId, "production/audio/voiceover.wav"))).toBe(false);
  });

  it("blocks when the render plan is missing", async () => {
    await enableDeterministicTts();
    const runId = await prepareReadyRun({ renderPlan: false });

    await expect(generateVoiceoverAudio(runId)).rejects.toThrow(/render plan/i);
    expect(await pathExists(artifactPath(runId, "production/audio/voiceover.wav"))).toBe(false);
  });

  it("blocks local Piper mode without a configured model path", async () => {
    await configureTts({ enabled: true, mode: "local-piper" });
    const runId = await prepareReadyRun({ renderPlan: true });

    await expect(generateVoiceoverAudio(runId)).rejects.toThrow(/piperModelPath/i);
    expect(await pathExists(artifactPath(runId, "production/audio/voiceover.wav"))).toBe(false);
  });

  it("rejects local Piper metadata without model provenance digests", () => {
    expect(() =>
      voiceoverAudioMetaSchema.parse({
        ...voiceoverMetaFixture(),
        mode: "local-piper",
        quality: "local-piper",
        provider: { binary: "piper", modelPath: "models/piper/model.onnx" },
      }),
    ).toThrow(/modelSha256/);
  });
});

function voiceoverMetaFixture() {
  return {
    schemaVersion: 1,
    runId: "run_voiceover_meta",
    createdAt: "2026-06-25T13:00:00.000Z",
    mode: "deterministic-local",
    quality: "deterministic-local-reference",
    source: { path: "production/voiceover.txt", sha256: "a".repeat(64), wordCount: 10 },
    renderPlan: { path: "production/render_plan.json", digest: "b".repeat(64) },
    output: {
      path: "production/audio/voiceover.wav",
      sha256: "c".repeat(64),
      bytes: 100,
      durationSeconds: 4,
      sampleRateHz: 16_000,
      channels: 1,
    },
  };
}

async function prepareReadyRun(options: { renderPlan: boolean }): Promise<string> {
  await createMinimalRenderAssets();
  const runId = await preparePackagedRun();
  if (options.renderPlan) {
    await generateRenderPlan(runId);
  }
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  const readiness = await runReadiness(runId);
  expect(readiness.passed).toBe(true);
  return runId;
}

async function preparePackagedRun(): Promise<string> {
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}

async function enableDeterministicTts(): Promise<void> {
  await configureTts({ enabled: true, mode: "deterministic-local" });
}

async function configureTts(
  tts: Record<string, unknown> & { enabled: boolean; mode: string },
): Promise<void> {
  const config = JSON.parse(await readFile("producer.config.json", "utf8")) as {
    providers: { tts: Record<string, unknown> };
  };
  config.providers.tts = tts;
  await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");
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
