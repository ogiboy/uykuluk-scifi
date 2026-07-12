import { mkdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { doctorMarkdownPath, runDoctor } from "../src/diagnostics/doctor";
import { useTempProject } from "./helpers";

describe("producer doctor TTS diagnostics", () => {
  useTempProject();

  it("passes local Piper diagnostics when the binary and model files are configured", async () => {
    await writePiperConfig({
      piperBinary: process.execPath,
      piperConfigPath: "models/piper/tr_TR/test/model.onnx.json",
      piperModelPath: "models/piper/tr_TR/test/model.onnx",
    });
    await mkdir("models/piper/tr_TR/test", { recursive: true });
    await writeFile("models/piper/tr_TR/test/model.onnx", "fake onnx", "utf8");
    await writeFile("models/piper/tr_TR/test/model.onnx.json", "{}", "utf8");

    const report = await runDoctor();

    expect(report.passed).toBe(true);
    expect(report.checks.find((check) => check.name === "TTS provider")).toMatchObject({
      status: "pass",
      message: expect.stringContaining("local-piper"),
      nextAction: expect.stringContaining("pnpm producer voice"),
    });
  });

  it("blocks local Piper diagnostics with exact setup guidance when files are missing", async () => {
    await writePiperConfig({
      piperBinary: "definitely-missing-piper-binary",
      piperConfigPath: "models/piper/tr_TR/test/model.onnx.json",
      piperModelPath: "models/piper/tr_TR/test/model.onnx",
    });

    const report = await runDoctor();
    const ttsCheck = report.checks.find((check) => check.name === "TTS provider");
    const markdown = await readFile(doctorMarkdownPath(), "utf8");

    expect(report.passed).toBe(false);
    expect(ttsCheck).toMatchObject({
      status: "block",
      message: expect.stringContaining("Piper binary unavailable"),
      nextAction: expect.stringContaining("pnpm tts:piper:setup"),
    });
    expect(ttsCheck?.message).toContain("Piper model missing");
    expect(ttsCheck?.message).toContain("Piper config missing");
    expect(markdown).toContain("copy the printed providers.tts override");
  });

  it("blocks ElevenLabs before reservation when the server credential is missing", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    await writeElevenLabsConfig("voice_doctor_test");

    const report = await runDoctor();

    expect(report.checks.find((check) => check.name === "TTS provider")).toMatchObject({
      status: "block",
      message: expect.stringContaining("ELEVENLABS_API_KEY"),
      nextAction: expect.stringContaining("server-side ELEVENLABS_API_KEY"),
    });
  });

  it("passes local ElevenLabs diagnostics without making a remote request", async () => {
    process.env.ELEVENLABS_API_KEY = "doctor-test-key";
    await writeElevenLabsConfig("voice_doctor_test");

    try {
      const report = await runDoctor();
      expect(report.checks.find((check) => check.name === "TTS provider")).toMatchObject({
        status: "pass",
        message: expect.stringContaining("eleven_v3"),
        nextAction: expect.stringContaining("cost quote"),
      });
    } finally {
      delete process.env.ELEVENLABS_API_KEY;
    }
  });
});

async function writePiperConfig(tts: {
  piperBinary: string;
  piperConfigPath: string;
  piperModelPath: string;
}): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: { ...defaultConfig.providers.tts, enabled: true, mode: "local-piper", ...tts },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function writeElevenLabsConfig(voiceId: string): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: {
            ...defaultConfig.providers.tts,
            enabled: true,
            mode: "elevenlabs",
            elevenLabs: { ...defaultConfig.providers.tts.elevenLabs, voiceId },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
