import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config/config";
import { runDoctor } from "../src/diagnostics/doctor";
import { useTempProject } from "./helpers";

describe("producer doctor llama.cpp provider", () => {
  useTempProject();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes when the configured llama.cpp model is served", async () => {
    await useLlamaCppConfig();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: "Mistral-7B-Instruct-v0.3.Q4_K_M.gguf" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const report = await runDoctor();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/v1/models",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(report.passed).toBe(true);
    expect(report.checks.find((check) => check.name === "LLM provider")).toMatchObject({
      status: "pass",
      message:
        "llama.cpp model Mistral-7B-Instruct-v0.3.Q4_K_M.gguf is available at http://localhost:8080.",
    });
  });

  it("blocks with a clear diagnostic when llama.cpp is unavailable", async () => {
    await useLlamaCppConfig();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const report = await runDoctor();

    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === "LLM provider")).toMatchObject({
      status: "block",
      message: expect.stringContaining("llama.cpp server unavailable at http://localhost:8080"),
      nextAction:
        "Start llama-server with the configured local GGUF model, or switch providers.llm.mode to mock before rerunning pnpm producer doctor.",
    });
  });
});

async function useLlamaCppConfig(): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          llm: {
            ...defaultConfig.providers.llm,
            mode: "llama.cpp",
            model: "Mistral-7B-Instruct-v0.3.Q4_K_M.gguf",
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
