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
          tts: {
            ...defaultConfig.providers.tts,
            enabled: true,
            mode: "local-piper",
            ...tts,
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
