import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getStudioModelEvalOverview } from "../apps/studio/src/lib/modelEvalOverview";
import type {
  LocalModelCandidateEvalReportPersisted,
  LocalModelEvalReportPersisted,
} from "../src/diagnostics/localModelEvalSchema";
import { useTempProject } from "./helpers";

const passingSingleReport = {
  appliedOverrides: [],
  checks: [
    {
      durationMs: 7,
      inputTokensApprox: 42,
      message: "3 ideas parsed.",
      name: "ideas-json",
      outputHash: "idea-output-hash",
      outputTokensApprox: 84,
      promptHash: "idea-prompt-hash",
      status: "pass",
    },
    {
      message: "180 words parsed.",
      name: "script-section-json",
      status: "pass",
    },
    {
      message: "Script section passed production content blockers.",
      name: "script-quality-guard",
      status: "pass",
    },
  ],
  configSource: "project",
  configuredModel: "mock-deterministic",
  createdAt: "2026-06-28T17:00:00.000Z",
  durationMs: 12,
  passed: true,
  providerMode: "mock",
} satisfies LocalModelEvalReportPersisted;

const blockedCandidateReport = {
  baseOverrides: ["mode"],
  candidates: [
    passingSingleReport,
    {
      ...passingSingleReport,
      appliedOverrides: ["mode", "model"],
      checks: [
        passingSingleReport.checks[0],
        {
          message: "Invalid script section.",
          name: "script-section-json",
          status: "block",
        },
      ],
      configuredModel: "mock-invalid-script-json",
      passed: false,
    },
  ],
  configSource: "cli-overrides",
  createdAt: "2026-06-28T17:01:00.000Z",
  durationMs: 34,
  passed: false,
  providerMode: "mock",
  operatorGuidance: {
    decision: "candidate-ready-with-blockers",
    message:
      "At least one candidate passed, but the comparison still has blocked candidates. Review blocked rows before changing producer.config.json.",
    nextCommand: "pnpm producer eval local-model --llm-mode mock --model mock-deterministic",
  },
  recommendedCandidate: {
    blockedChecks: 0,
    configuredModel: "mock-deterministic",
    durationMs: 12,
    passedChecks: 3,
  },
} satisfies LocalModelCandidateEvalReportPersisted;

describe("Studio local model evaluation overview", () => {
  useTempProject();

  it("returns a safe missing state before eval diagnostics are generated", async () => {
    const overview = await getStudioModelEvalOverview();

    expect(overview).toMatchObject({
      error: null,
      nextCommand: "pnpm producer eval local-model",
      status: "missing",
    });
    expect(overview.singleReport).toBeNull();
    expect(overview.candidateReport).toBeNull();
  });

  it("summarizes local model eval artifacts without mutation", async () => {
    await mkdir("diagnostics", { recursive: true });
    await writeFile(
      "diagnostics/local_model_eval.json",
      JSON.stringify(passingSingleReport),
      "utf8",
    );
    await writeFile(
      "diagnostics/local_model_eval.md",
      "# Local Model Evaluation\n\nPassed: true\n",
      "utf8",
    );
    await writeFile(
      "diagnostics/local_model_candidates_eval.json",
      JSON.stringify(blockedCandidateReport),
      "utf8",
    );
    await writeFile(
      "diagnostics/local_model_candidates_eval.md",
      "# Local Model Candidate Evaluation\n\nPassed: false\n",
      "utf8",
    );

    const overview = await getStudioModelEvalOverview();

    expect(overview).toMatchObject({
      error: null,
      nextCommand: "pnpm producer eval local-model --llm-mode mock --model mock-deterministic",
      status: "recommended",
      singleReport: {
        blockCount: 0,
        checkCount: 3,
        configuredModel: "mock-deterministic",
        passCount: 3,
        passed: true,
        checks: [
          expect.objectContaining({
            durationMs: 7,
            inputTokensApprox: 42,
            message: "3 ideas parsed.",
            name: "ideas-json",
            outputHash: "idea-output-hash",
            outputTokensApprox: 84,
            promptHash: "idea-prompt-hash",
            status: "pass",
          }),
          expect.objectContaining({
            message: "180 words parsed.",
            name: "script-section-json",
            status: "pass",
          }),
          expect.objectContaining({
            message: "Script section passed production content blockers.",
            name: "script-quality-guard",
            status: "pass",
          }),
        ],
      },
      candidateReport: {
        blockedCandidateCount: 1,
        candidateCount: 2,
        passingCandidateCount: 1,
        passed: false,
        operatorGuidance: expect.objectContaining({
          nextCommand: "pnpm producer eval local-model --llm-mode mock --model mock-deterministic",
        }),
        recommendedCandidate: expect.objectContaining({
          configuredModel: "mock-deterministic",
          durationMs: 12,
          passed: true,
        }),
      },
      singleReportPreview: expect.stringContaining("Local Model Evaluation"),
      candidateReportPreview: expect.stringContaining("Local Model Candidate Evaluation"),
    });
    expect(overview.candidateReport?.candidates).toContainEqual(
      expect.objectContaining({
        blockCount: 1,
        checks: expect.arrayContaining([
          expect.objectContaining({
            message: "Invalid script section.",
            name: "script-section-json",
            status: "block",
          }),
        ]),
        configuredModel: "mock-invalid-script-json",
        durationMs: 12,
        passed: false,
      }),
    );
  });

  it("distinguishes malformed eval JSON from schema validation failures", async () => {
    await mkdir("diagnostics", { recursive: true });
    await writeFile("diagnostics/local_model_eval.json", "{", "utf8");

    await expect(getStudioModelEvalOverview()).resolves.toMatchObject({
      error: "diagnostics/local_model_eval.json contains malformed JSON or a truncated write.",
      status: "invalid",
    });

    await writeFile("diagnostics/local_model_eval.json", JSON.stringify({ checks: [] }), "utf8");

    await expect(getStudioModelEvalOverview()).resolves.toMatchObject({
      error: "diagnostics/local_model_eval.json is missing required fields.",
      status: "invalid",
    });
  });
});
