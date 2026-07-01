import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import {
  localModelCandidateEvalJsonPath,
  localModelCandidateEvalMarkdownPath,
  runLocalModelCandidateEval,
  selectRecommendedLocalModelCandidate,
} from "../src/diagnostics/localModelCandidateEval";
import {
  formatLocalModelCandidateEvalConsole,
  renderLocalModelCandidateEvalMarkdown,
} from "../src/diagnostics/localModelCandidateEvalFormatting";
import { LocalModelEvalReport } from "../src/diagnostics/localModelEval";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

describe("local model candidate evaluation", () => {
  useTempProject();

  it("compares candidate models without mutating project config or storing raw output", async () => {
    await useOllamaConfig();
    const beforeConfig = await readFile("producer.config.json", "utf8");

    const report = await runLocalModelCandidateEval({
      candidates: ["mock-deterministic", "mock-invalid-script-json", "mock-deterministic"],
      llmOverrides: { mode: "mock" },
    });

    expect(report).toMatchObject({
      baseOverrides: ["mode"],
      candidates: [
        expect.objectContaining({
          configuredModel: "mock-deterministic",
          passed: true,
        }),
        expect.objectContaining({
          configuredModel: "mock-invalid-script-json",
          passed: false,
        }),
      ],
      configSource: "cli-overrides",
      passed: false,
      providerMode: "mock",
      operatorGuidance: {
        decision: "candidate-ready-with-blockers",
        nextCommand: "pnpm producer eval local-model --llm-mode mock --model mock-deterministic",
      },
      recommendedCandidate: {
        blockedChecks: 0,
        configuredModel: "mock-deterministic",
        durationMs: expect.any(Number),
        passedChecks: 3,
      },
    });
    expect(report.candidates).toHaveLength(2);
    expect(await pathExists(localModelCandidateEvalJsonPath())).toBe(true);
    expect(await pathExists(localModelCandidateEvalMarkdownPath())).toBe(true);
    expect(await readJsonFile(localModelCandidateEvalJsonPath())).toEqual(report);
    expect(JSON.stringify(report)).not.toContain("Mock provider returned non-JSON");
    expect(await readFile(localModelCandidateEvalJsonPath(), "utf8")).not.toContain(
      "Mock provider returned non-JSON",
    );
    expect(await readFile(localModelCandidateEvalMarkdownPath(), "utf8")).not.toContain(
      "Mock provider returned non-JSON",
    );
    await expect(readFile("producer.config.json", "utf8")).resolves.toBe(beforeConfig);
    expect(formatLocalModelCandidateEvalConsole(report)).toContain(
      "[block] mock-invalid-script-json",
    );
    expect(formatLocalModelCandidateEvalConsole(report)).toContain(
      "Recommended: mock-deterministic",
    );
    expect(formatLocalModelCandidateEvalConsole(report)).toContain(
      "Next command: pnpm producer eval local-model --llm-mode mock --model mock-deterministic",
    );
    expect(formatLocalModelCandidateEvalConsole(report)).toContain(
      "At least one candidate passed, but the comparison still has blocked candidates.",
    );
    expect(renderLocalModelCandidateEvalMarkdown(report)).toContain("mock-invalid-script-json");
    expect(renderLocalModelCandidateEvalMarkdown(report)).toContain(
      "Recommended candidate: mock-deterministic",
    );
    expect(renderLocalModelCandidateEvalMarkdown(report)).toContain(
      "Next command: `pnpm producer eval local-model --llm-mode mock --model mock-deterministic`",
    );
  });

  it("does not recommend a candidate when every local model candidate blocks", async () => {
    const report = await runLocalModelCandidateEval({
      candidates: ["mock-invalid-script-json"],
      llmOverrides: { mode: "mock" },
    });

    expect(report).toMatchObject({
      candidates: [
        expect.objectContaining({
          configuredModel: "mock-invalid-script-json",
          passed: false,
        }),
      ],
      passed: false,
      operatorGuidance: {
        decision: "try-more-candidates",
        nextCommand:
          "pnpm producer eval local-model-candidates --llm-mode mock --candidate <another-model>",
      },
      recommendedCandidate: null,
    });
    expect(formatLocalModelCandidateEvalConsole(report)).toContain(
      "Recommended: none; no candidate passed all checks",
    );
    expect(renderLocalModelCandidateEvalMarkdown(report)).toContain(
      "Recommended candidate: none; no candidate passed all checks",
    );
    expect(renderLocalModelCandidateEvalMarkdown(report)).toContain(
      "No candidate passed all parser-contract checks.",
    );
  });

  it("does not mark an empty candidate comparison as passing", async () => {
    const report = await runLocalModelCandidateEval({
      candidates: [],
      llmOverrides: { mode: "mock" },
    });

    expect(report).toMatchObject({
      candidates: [],
      passed: false,
      operatorGuidance: {
        decision: "try-more-candidates",
      },
      recommendedCandidate: null,
    });
  });

  it("quotes unsafe model names in operator guidance commands", async () => {
    const report = await runLocalModelCandidateEval({
      candidates: ["mock candidate's model"],
      llmOverrides: { mode: "mock" },
    });

    expect(report.operatorGuidance.nextCommand).toBe(
      `pnpm producer eval local-model --llm-mode mock --model 'mock candidate'"'"'s model'`,
    );
  });

  it("marks guidance fully ready only when every candidate passes", async () => {
    const report = await runLocalModelCandidateEval({
      candidates: ["mock-deterministic"],
      llmOverrides: { mode: "mock" },
    });

    expect(report).toMatchObject({
      passed: true,
      operatorGuidance: {
        decision: "candidate-ready",
        message:
          "All compared candidates passed the parser-contract checks. Review the report, then run a single-model eval before changing producer.config.json.",
      },
    });
  });

  it("ranks passing candidate recommendations deterministically", () => {
    const recommended = selectRecommendedLocalModelCandidate([
      localModelCandidateReport("mock-slower", 20),
      localModelCandidateReport("mock-faster-z", 10),
      localModelCandidateReport("mock-faster-a", 10),
      localModelCandidateReport("mock-blocked", 1, false),
    ]);

    expect(recommended).toEqual({
      blockedChecks: 0,
      configuredModel: "mock-faster-a",
      durationMs: 10,
      passedChecks: 3,
    });
  });
});

function localModelCandidateReport(
  configuredModel: string,
  durationMs: number,
  passed = true,
): LocalModelEvalReport {
  return {
    appliedOverrides: ["mode", "model"],
    checks: [
      {
        message: passed ? "2 ideas parsed." : "Invalid JSON.",
        name: "ideas-json",
        status: passed ? "pass" : "block",
      },
      {
        message: "42 words parsed.",
        name: "script-section-json",
        status: "pass",
      },
      {
        message: "Script section passed production content blockers.",
        name: "script-quality-guard",
        status: "pass",
      },
    ],
    configSource: "cli-overrides",
    configuredModel,
    createdAt: "2026-06-28T18:00:00.000Z",
    durationMs,
    passed,
    providerMode: "mock",
  };
}

async function useOllamaConfig(): Promise<void> {
  await writeLlmConfig({ mode: "ollama" });
}

async function writeLlmConfig(
  llm: Partial<(typeof defaultConfig.providers)["llm"]>,
): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          llm: {
            ...defaultConfig.providers.llm,
            ...llm,
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
