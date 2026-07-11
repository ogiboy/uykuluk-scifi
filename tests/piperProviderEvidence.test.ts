import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPiperProviderEvidence } from "../src/stages/piperProviderEvidence";
import { renderVoiceoverReviewMarkdown } from "../src/stages/voiceoverReviewMarkdown";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "uykulukscifi-piper-evidence-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("Piper provider evidence", () => {
  it("records model and config digests for local voice review", async () => {
    const modelPath = path.join(tempDir, "model.onnx");
    const configPath = path.join(tempDir, "model.onnx.json");
    const modelContent = "fake piper model";
    const configContent = '{"audio":{"sample_rate":16000}}';
    await writeFile(modelPath, modelContent, "utf8");
    await writeFile(configPath, configContent, "utf8");

    const provider = await readPiperProviderEvidence({ binary: "piper", configPath, modelPath });
    const markdown = renderVoiceoverReviewMarkdown({
      schemaVersion: 1,
      runId: "run_piper_provenance",
      createdAt: "2026-06-25T13:00:00.000Z",
      mode: "local-piper",
      quality: "local-piper",
      source: { path: "production/voiceover.txt", sha256: sha256("voiceover"), wordCount: 12 },
      renderPlan: { path: "production/render_plan.json", digest: sha256("render-plan") },
      output: {
        path: "production/audio/voiceover.wav",
        sha256: sha256("audio"),
        bytes: 100,
        durationSeconds: 3,
        sampleRateHz: 16_000,
        channels: 1,
      },
      provider,
    });

    expect(provider).toMatchObject({
      binary: "piper",
      modelPath,
      modelSha256: sha256(modelContent),
      configPath,
      configSha256: sha256(configContent),
    });
    expect(markdown).toContain("## Local TTS Provider Provenance");
    expect(markdown).toContain("Piper model SHA-256");
    expect(markdown).toContain(sha256(modelContent));
    expect(markdown).toContain("Piper config SHA-256");
    expect(markdown).toContain(sha256(configContent));
  });

  it("fails closed when local Piper model evidence is unavailable", async () => {
    await expect(
      readPiperProviderEvidence({ binary: "piper", modelPath: path.join(tempDir, "missing.onnx") }),
    ).rejects.toThrow(/Piper model is missing/);
  });

  it("fails closed when local Piper model path is not configured", async () => {
    await expect(readPiperProviderEvidence({ binary: "piper" })).rejects.toThrow(/piperModelPath/);
  });

  it("records model digest without optional config evidence", async () => {
    const modelPath = path.join(tempDir, "model-only.onnx");
    const modelContent = "fake piper model without config";
    await writeFile(modelPath, modelContent, "utf8");

    await expect(readPiperProviderEvidence({ binary: "piper", modelPath })).resolves.toEqual({
      binary: "piper",
      modelPath,
      modelSha256: sha256(modelContent),
    });
  });

  it("fails closed when configured Piper config evidence is missing", async () => {
    const modelPath = path.join(tempDir, "model-with-missing-config.onnx");
    await writeFile(modelPath, "fake piper model", "utf8");

    await expect(
      readPiperProviderEvidence({
        binary: "piper",
        configPath: path.join(tempDir, "missing.onnx.json"),
        modelPath,
      }),
    ).rejects.toThrow(/Piper model config is missing/);
  });
});

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
