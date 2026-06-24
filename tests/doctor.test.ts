import { mkdir, readFile, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config/config";
import { listRuns } from "../src/core/runStore";
import { doctorJsonPath, doctorMarkdownPath, runDoctor } from "../src/diagnostics/doctor";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

describe("producer doctor", () => {
  useTempProject();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes mock mode, warns on missing assets, and writes durable diagnostics", async () => {
    const report = await runDoctor();

    expect(report.passed).toBe(true);
    expect(report.durationMs).toEqual(expect.any(Number));
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "project config", status: "pass" }),
        expect.objectContaining({ name: "LLM provider", status: "pass" }),
        expect.objectContaining({
          name: "TTS provider",
          status: "pass",
          message: expect.stringContaining("disabled"),
        }),
        expect.objectContaining({ name: "production assets", status: "warn" }),
        expect.objectContaining({ name: "publish defaults", status: "pass" }),
      ]),
    );
    expect(await pathExists(doctorJsonPath())).toBe(true);
    expect(await pathExists(doctorMarkdownPath())).toBe(true);
    expect(await readJsonFile(doctorJsonPath())).toEqual(report);
    expect(await readFile(doctorMarkdownPath(), "utf8")).toContain("# Producer Doctor");
    expect(await listRuns()).toEqual([]);
  });

  it("blocks with a clear diagnostic when Ollama is unavailable", async () => {
    await useOllamaConfig();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const report = await runDoctor();

    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === "LLM provider")).toMatchObject({
      status: "block",
      message: expect.stringContaining("Ollama unavailable at http://localhost:11434"),
    });
    expect(await readJsonFile(doctorJsonPath())).toEqual(report);
  });

  it("blocks when the configured Ollama model is not installed", async () => {
    await useOllamaConfig();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: "llama3.2:3b" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const report = await runDoctor();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/tags",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === "LLM provider")).toMatchObject({
      status: "block",
      message: expect.stringContaining(defaultConfig.providers.llm.model),
    });
  });

  it("does not persist an Ollama HTTP response body in diagnostics", async () => {
    await useOllamaConfig();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("local-secret-response", {
          status: 500,
          statusText: "Internal Server Error",
        }),
      ),
    );

    const report = await runDoctor();
    const providerCheck = report.checks.find((check) => check.name === "LLM provider");

    expect(providerCheck).toMatchObject({
      status: "block",
      message: "Ollama diagnostics failed (500 Internal Server Error).",
    });
    expect(JSON.stringify(report)).not.toContain("local-secret-response");
  });

  it("blocks invalid config and still persists the diagnostic", async () => {
    await writeFile("producer.config.json", '{"providers":', "utf8");

    const report = await runDoctor();

    expect(report.passed).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "project config",
          status: "block",
          message: expect.stringContaining("invalid"),
        }),
        expect.objectContaining({ name: "LLM provider", status: "block" }),
        expect.objectContaining({ name: "publish defaults", status: "block" }),
      ]),
    );
    expect(await readJsonFile(doctorJsonPath())).toEqual(report);
  });

  it("blocks risky YouTube enablement", async () => {
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          providers: {
            ...defaultConfig.providers,
            youtube: {
              enabled: true,
              allowPrivateUpload: true,
              allowPublicPublish: true,
            },
          },
          safeguards: {
            ...defaultConfig.safeguards,
            neverPublicPublishWithoutExplicitApproval: false,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const report = await runDoctor();

    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === "publish defaults")).toMatchObject({
      status: "block",
      message: expect.stringContaining("Risky YouTube configuration"),
    });
  });

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
    });
  });

  it("blocks local Piper diagnostics when binary or model files are missing", async () => {
    await writePiperConfig({
      piperBinary: "definitely-missing-piper-binary",
      piperConfigPath: "models/piper/tr_TR/test/model.onnx.json",
      piperModelPath: "models/piper/tr_TR/test/model.onnx",
    });

    const report = await runDoctor();

    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === "TTS provider")).toMatchObject({
      status: "block",
      message: expect.stringContaining("Piper binary unavailable"),
    });
    expect(report.checks.find((check) => check.name === "TTS provider")?.message).toContain(
      "Piper model missing",
    );
    expect(report.checks.find((check) => check.name === "TTS provider")?.message).toContain(
      "Piper config missing",
    );
  });
});

async function useOllamaConfig(): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          llm: {
            ...defaultConfig.providers.llm,
            mode: "ollama",
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

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
