import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config/config";
import { listRuns } from "../src/core/runStore";
import {
  doctorJsonPath,
  doctorMarkdownPath,
  formatDoctorConsole,
  runDoctor,
} from "../src/diagnostics/doctor";
import { renderToolchainCheck } from "../src/diagnostics/renderToolchainDoctor";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

describe("producer doctor", () => {
  useTempProject();

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("passes mock mode, warns on missing assets, and writes durable diagnostics", async () => {
    const report = await runDoctor();

    expect(report.passed).toBe(true);
    expect(report.durationMs).toEqual(expect.any(Number));
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "project config", status: "pass" }),
        expect.objectContaining({
          name: "prompt overrides",
          status: "pass",
          message: "No local prompt overrides configured.",
        }),
        expect.objectContaining({ name: "LLM provider", status: "pass" }),
        expect.objectContaining({
          name: "TTS provider",
          status: "pass",
          message: expect.stringContaining("disabled"),
          nextAction: expect.stringContaining("pnpm tts:piper:setup"),
        }),
        expect.objectContaining({
          name: "render toolchain",
          status: expect.stringMatching(/^(pass|warn)$/),
        }),
        expect.objectContaining({ name: "production assets", status: "warn" }),
        expect.objectContaining({ name: "publish defaults", status: "pass" }),
      ]),
    );
    expect(await pathExists(doctorJsonPath())).toBe(true);
    expect(await pathExists(doctorMarkdownPath())).toBe(true);
    expect(await readJsonFile(doctorJsonPath())).toEqual(report);
    const markdown = await readFile(doctorMarkdownPath(), "utf8");
    expect(markdown).toContain("# Producer Doctor");
    expect(markdown).toContain("Next action");
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
      nextAction:
        "Start Ollama, install the configured model, or switch providers.llm.mode to mock before rerunning pnpm producer doctor.",
    });
    expect(await readJsonFile(doctorJsonPath())).toEqual(report);
  });

  it("surfaces diagnostic next actions in terminal output", async () => {
    await useOllamaConfig();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const output = formatDoctorConsole(await runDoctor());

    expect(output).toContain("Doctor blocked.");
    expect(output).toContain("[block] LLM provider: Ollama unavailable at http://localhost:11434");
    expect(output).toContain(
      "Next action: Start Ollama, install the configured model, or switch providers.llm.mode to mock before rerunning pnpm producer doctor.",
    );
  });

  it("blocks when the configured Ollama model is not installed", async () => {
    await useOllamaConfig();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
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
      vi
        .fn()
        .mockResolvedValue(
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

  it("passes render toolchain diagnostics for explicit executable paths", async () => {
    const binDir = await writeFakeRenderTools();

    const check = renderToolchainCheck(renderToolPaths(binDir));

    expect(check).toMatchObject({
      status: "pass",
      message: "FFmpeg, ffprobe, and two-pass loudnorm are available for local draft render.",
    });
  });

  it("warns when draft-render tools are unavailable", async () => {
    await mkdir("empty-bin", { recursive: true });
    const emptyBin = path.join(process.cwd(), "empty-bin");

    const check = renderToolchainCheck(renderToolPaths(emptyBin));

    expect(check).toMatchObject({
      status: "warn",
      message: expect.stringContaining("FFmpeg, ffprobe unavailable"),
      nextAction:
        "Install FFmpeg/ffprobe in a standard executable location, then rerun pnpm producer doctor.",
    });
  });

  it("warns when FFmpeg lacks the loudnorm mastering filter", async () => {
    const binDir = await writeFakeRenderTools(false);

    const check = renderToolchainCheck(renderToolPaths(binDir));

    expect(check).toMatchObject({
      status: "warn",
      message: expect.stringContaining("loudnorm filter is unavailable"),
    });
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
            youtube: { enabled: true, allowPrivateUpload: true, allowPublicPublish: true },
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
      nextAction:
        "Set providers.youtube.enabled, allowPrivateUpload, and allowPublicPublish to false unless a future upload/publish approval workflow is explicitly enabled.",
    });
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
          llm: { ...defaultConfig.providers.llm, mode: "ollama" },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function writeFakeRenderTools(withLoudnorm = true): Promise<string> {
  const binDir = path.join(process.cwd(), ".tmp", "render-tools", "doctor");
  await mkdir(binDir, { recursive: true });
  await writeFakeExecutable(
    path.join(binDir, "ffmpeg"),
    withLoudnorm
      ? "#!/bin/sh\nprintf '%s\\n' '... loudnorm EBU R128 loudness normalization'\n"
      : "#!/bin/sh\nprintf '%s\\n' 'ffmpeg without mastering filter'\n",
  );
  await writeFakeExecutable(path.join(binDir, "ffprobe"));
  return binDir;
}

function renderToolPaths(binDir: string) {
  return { ffmpegBinary: path.join(binDir, "ffmpeg"), ffprobeBinary: path.join(binDir, "ffprobe") };
}

async function writeFakeExecutable(
  target: string,
  body = "#!/bin/sh\nprintf '%s\\n' fake-tool\n",
): Promise<void> {
  await writeFile(target, body, "utf8");
  await chmod(target, 0o755);
}
