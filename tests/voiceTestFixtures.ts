import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";

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
import { wavFromPcm16 } from "../src/stages/voice/voiceWav";
import { createMinimalRenderAssets } from "./renderTestHelpers";
import { prepareApprovedStaticVisuals } from "./visualTestHelpers";

/** Creates a deterministic voiceover metadata fixture for schema validation. */
export function voiceoverMetaFixture() {
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

/** Prepares a packaged run through readiness, optionally including its render plan. */
export async function prepareReadyRun(options: { renderPlan: boolean }): Promise<string> {
  await createMinimalRenderAssets();
  const runId = await preparePackagedRun();
  if (options.renderPlan) {
    await prepareApprovedStaticVisuals(runId);
    await generateRenderPlan(runId);
  }
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  const readiness = await runReadiness(runId);
  expect(readiness.passed).toBe(true);
  return runId;
}

/** Enables the deterministic local timing/reference text-to-speech mode. */
export async function enableDeterministicTts(): Promise<void> {
  await configureTts({ enabled: true, mode: "deterministic-local" });
}

/** Creates and configures a fake local Piper executable and model fixture. */
export async function enableFakePiper(): Promise<{
  binary: string;
  modelPath: string;
  configPath: string;
}> {
  const binary = path.resolve("scripts/fake-piper-test.mjs");
  const modelPath = path.resolve("models/piper/test/model.onnx");
  const configPath = path.resolve("models/piper/test/model.onnx.json");
  const wav = wavFromPcm16(Buffer.alloc(24_000 * 2), 24_000, 1);
  await mkdir(path.dirname(binary), { recursive: true });
  await mkdir(path.dirname(modelPath), { recursive: true });
  await writeFile(modelPath, "fake local Piper model", "utf8");
  await writeFile(configPath, '{"audio":{"sample_rate":24000}}', "utf8");
  await writeFile(
    binary,
    `#!/usr/bin/env node\nimport { writeFileSync } from "node:fs";\nconst outputIndex = process.argv.indexOf("--output_file");\nwriteFileSync(process.argv[outputIndex + 1], Buffer.from("${wav.toString("base64")}", "base64"));\n`,
    "utf8",
  );
  await chmod(binary, 0o755);
  await configureTts({
    enabled: true,
    mode: "local-piper",
    piperBinary: binary,
    piperModelPath: modelPath,
    piperConfigPath: configPath,
  });
  return { binary, modelPath, configPath };
}

/** Replaces the current temp project's TTS configuration. */
export async function configureTts(
  tts: Record<string, unknown> & { enabled: boolean; mode: string },
): Promise<void> {
  const config = JSON.parse(await readFile("producer.config.json", "utf8")) as {
    providers: { tts: Record<string, unknown> };
  };
  config.providers.tts = tts;
  await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

/** Prepares a run through production-package generation without readiness or render planning. */
export async function preparePackagedRun(): Promise<string> {
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}
