import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatLocalModelEvalConsole,
  renderLocalModelEvalMarkdown,
} from "../src/diagnostics/localModelEvalFormatting";
import {
  localModelEvalJsonPath,
  localModelEvalMarkdownPath,
  runLocalModelEval,
} from "../src/diagnostics/localModelEval";
import { safeLocalModelEvalErrorMessage } from "../src/diagnostics/localModelEvalSafety";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import { writeLlmConfig } from "./localModelEvalTestHelpers";

describe("local model evaluation", () => {
  useTempProject();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists parser-contract results without raw mock output", async () => {
    const report = await runLocalModelEval();

    expect(report).toMatchObject({
      passed: true,
      providerMode: "mock",
      checks: [
        expect.objectContaining({ name: "ideas-json", status: "pass" }),
        expect.objectContaining({ name: "script-section-json", status: "pass" }),
        expect.objectContaining({ name: "script-quality-guard", status: "pass" }),
      ],
    });
    expect(await pathExists(localModelEvalJsonPath())).toBe(true);
    expect(await pathExists(localModelEvalMarkdownPath())).toBe(true);
    expect(await readJsonFile(localModelEvalJsonPath())).toEqual(report);
    expect(JSON.stringify(report)).not.toContain("Bazı gezegenler vardır");

    const markdown = await readFile(localModelEvalMarkdownPath(), "utf8");
    expect(markdown).toContain("# Local Model Evaluation");
    expect(markdown).toContain("Raw provider output is intentionally not persisted.");
    expect(formatLocalModelEvalConsole(report)).toContain("Local model eval passed.");
    expect(renderLocalModelEvalMarkdown(report)).toContain("| ideas-json | pass |");
    expect(renderLocalModelEvalMarkdown(report)).toContain("| script-quality-guard | pass |");
  });

  it("sanitizes Ollama HTTP response bodies in blocked eval reports", async () => {
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

    const report = await runLocalModelEval();

    expect(report.passed).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Ollama request failed (500).",
          status: "block",
        }),
      ]),
    );
    expect(JSON.stringify(report)).not.toContain("local-secret-response");
    expect(await readFile(localModelEvalJsonPath(), "utf8")).not.toContain("local-secret-response");
    expect(await readFile(localModelEvalMarkdownPath(), "utf8")).not.toContain(
      "local-secret-response",
    );
  });

  it("blocks invalid mock parser outputs without raw provider text", async () => {
    await useMockModel("mock-invalid-ideas-always");

    const invalidIdeasReport = await runLocalModelEval();

    expect(invalidIdeasReport.passed).toBe(false);
    expect(invalidIdeasReport.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ideas-json",
          status: "block",
          provider: "mock",
          model: "mock-invalid-ideas-always",
        }),
      ]),
    );

    await useMockModel("mock-invalid-script-json");

    const invalidScriptReport = await runLocalModelEval();

    expect(invalidScriptReport.passed).toBe(false);
    expect(invalidScriptReport.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "script-section-json",
          status: "block",
          provider: "mock",
          model: "mock-invalid-script-json",
        }),
        expect.objectContaining({
          name: "script-quality-guard",
          status: "block",
          message: "Skipped because script-section-json could not be parsed.",
        }),
      ]),
    );
    expect(JSON.stringify(invalidScriptReport)).not.toContain(
      "Mock provider returned non-JSON script section text.",
    );
  });

  it("blocks parsed script text that fails production content guards", async () => {
    await useMockModel("mock-script-quality-artifacts");

    const report = await runLocalModelEval();

    expect(report.passed).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "script-section-json",
          status: "pass",
        }),
        expect.objectContaining({
          name: "script-quality-guard",
          status: "block",
          message: expect.stringContaining("provider_artifact_metadata"),
        }),
        expect.objectContaining({
          name: "script-quality-guard",
          message: expect.stringContaining("repeated_word_stutter"),
        }),
      ]),
    );
    expect(JSON.stringify(report)).not.toContain("kor kor");
    expect(await readFile(localModelEvalJsonPath(), "utf8")).not.toContain("section_id");
    expect(await readFile(localModelEvalMarkdownPath(), "utf8")).not.toContain("section_id");
  });

  it("sanitizes Ollama provider error payloads in blocked eval reports", async () => {
    await useOllamaConfig();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "local-secret-response" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const report = await runLocalModelEval();

    expect(report.passed).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Ollama provider reported an error.",
          status: "block",
        }),
      ]),
    );
    expect(JSON.stringify(report)).not.toContain("local-secret-response");
    expect(await readFile(localModelEvalJsonPath(), "utf8")).not.toContain("local-secret-response");
    expect(await readFile(localModelEvalMarkdownPath(), "utf8")).not.toContain(
      "local-secret-response",
    );
  });

  it("does not echo unknown eval exception messages", () => {
    expect(safeLocalModelEvalErrorMessage(new Error("raw model output: local-secret"))).toBe(
      "Provider evaluation failed.",
    );
    expect(
      safeLocalModelEvalErrorMessage(new Error("llama.cpp returned invalid JSON: local-secret")),
    ).toBe("llama.cpp provider returned invalid JSON.");
    expect(
      safeLocalModelEvalErrorMessage(
        new Error("Invalid ideas provider response: targetDuration: Required"),
      ),
    ).toBe("Invalid ideas provider response: targetDuration: Required");
  });

  it("applies eval-only LLM overrides without mutating project config", async () => {
    await useOllamaConfig();
    const beforeConfig = await readFile("producer.config.json", "utf8");

    const report = await runLocalModelEval({
      llmOverrides: {
        mode: "mock",
        model: "mock-invalid-script-json",
      },
    });

    expect(report).toMatchObject({
      appliedOverrides: ["mode", "model"],
      configSource: "cli-overrides",
      configuredModel: "mock-invalid-script-json",
      providerMode: "mock",
      passed: false,
      checks: expect.arrayContaining([
        expect.objectContaining({
          name: "script-section-json",
          status: "block",
        }),
      ]),
    });
    await expect(readFile("producer.config.json", "utf8")).resolves.toBe(beforeConfig);
    expect(renderLocalModelEvalMarkdown(report)).toContain("Overrides: mode, model");
  });
});

async function useMockModel(model: string): Promise<void> {
  await writeLlmConfig({ mode: "mock", model });
}

async function useOllamaConfig(): Promise<void> {
  await writeLlmConfig({ mode: "ollama" });
}
