import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runReadiness } from "../src/stages/readiness";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { pathExists } from "../src/utils/fs";
import { sha256 } from "../src/utils/hash";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import { createMinimalRenderAssets } from "./renderTestHelpers";
import { prepareApprovedStaticVisuals } from "./visualTestHelpers";
import {
  configureTts,
  enableDeterministicTts,
  enableFakePiper,
  preparePackagedRun,
  prepareReadyRun,
} from "./voiceTestFixtures";

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
    await prepareApprovedStaticVisuals(runId);
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

  it("runs reviewed local Piper through the shared orchestrator without paid gates", async () => {
    const piper = await enableFakePiper();
    const runId = await prepareReadyRun({ renderPlan: true });

    const meta = await generateVoiceoverAudio(runId);

    expect(meta).toMatchObject({
      mode: "local-piper",
      quality: "local-piper",
      provider: {
        binary: piper.binary,
        modelPath: piper.modelPath,
        modelSha256: sha256("fake local Piper model"),
        configPath: piper.configPath,
        configSha256: sha256('{"audio":{"sample_rate":24000}}'),
      },
      output: {
        path: "production/audio/voiceover.wav",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(meta.paidExecution).toBeUndefined();
    expect(meta.alignment).toBeUndefined();
    expect(await readCostReservationSummaries(runId)).toEqual([]);
    const run = await loadRun(runId);
    expect(run.artifacts.some((item) => item.includes("voice-candidates"))).toBe(false);
    expect(run.artifacts.some((item) => item.includes("voice-selections"))).toBe(false);
    const wav = await readFile(artifactPath(runId, "production/audio/voiceover.wav"));
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    const evidence = (await generateEvidenceBundle(runId)) as {
      voiceoverAudio: {
        status: string;
        mode: string;
        productionVoiceCandidate: boolean;
        quality: string;
      };
    };
    expect(evidence.voiceoverAudio).toMatchObject({
      status: "pass",
      mode: "local-piper",
      productionVoiceCandidate: true,
      quality: "local-piper",
    });
  });
});
