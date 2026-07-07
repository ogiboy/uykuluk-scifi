import path from "node:path";
import { loadConfig } from "../config/config.js";
import { ProducerConfig } from "../config/schema.js";
import { LlamaCppProvider } from "../providers/llamaCppProvider.js";
import { writeTextFile } from "../utils/fs.js";
import { writeJsonFile } from "../utils/json.js";
import { shellQuote } from "../utils/shell.js";
import { nowIso } from "../utils/time.js";
import { renderLocalModelCandidateEvalMarkdown } from "./localModelCandidateEvalFormatting.js";
import {
  llamaCppDiagnosticFailureReport,
  unservedLlamaCppCandidateReport,
} from "./localModelCandidateEvalReports.js";
import {
  selectRecommendedLocalModelCandidate,
  type LocalModelCandidateRecommendation,
} from "./localModelCandidateRecommendation.js";
import { LocalModelEvalReport, runLocalModelEvalWithConfig } from "./localModelEval.js";
import {
  applyLocalModelEvalOverrides,
  LocalModelEvalLlmOverrides,
} from "./localModelEvalConfig.js";

export { selectRecommendedLocalModelCandidate } from "./localModelCandidateRecommendation.js";

export type LocalModelCandidateEvalOptions = {
  candidates: string[];
  llmOverrides?: Omit<LocalModelEvalLlmOverrides, "model">;
};

export type LocalModelCandidateEvalReport = {
  baseOverrides: string[];
  candidates: LocalModelEvalReport[];
  configSource: "cli-overrides" | "project";
  createdAt: string;
  durationMs: number;
  passed: boolean;
  providerMode: ProducerConfig["providers"]["llm"]["mode"];
  operatorGuidance: LocalModelCandidateOperatorGuidance;
  recommendedCandidate: LocalModelCandidateRecommendation | null;
};

export type LocalModelCandidateOperatorGuidance = {
  decision: "candidate-ready" | "candidate-ready-with-blockers" | "try-more-candidates";
  message: string;
  nextCommand: string;
};

type ServedLlamaCppModelsResult =
  { models: string[]; status: "pass" } | { message: string; status: "block" };

/**
 * Gets the absolute path to the local model candidate evaluation JSON report.
 *
 * @returns The absolute path to `diagnostics/local_model_candidates_eval.json`.
 */
export function localModelCandidateEvalJsonPath(): string {
  return path.join(process.cwd(), "diagnostics", "local_model_candidates_eval.json");
}

/**
 * Gets the absolute path to the local model candidate evaluation Markdown report.
 *
 * @returns The absolute path to `diagnostics/local_model_candidates_eval.md`.
 */
export function localModelCandidateEvalMarkdownPath(): string {
  return path.join(process.cwd(), "diagnostics", "local_model_candidates_eval.md");
}

/**
 * Evaluates multiple local model candidates through the same parser-contract checks.
 *
 * @param options - Candidate model names and optional one-run provider overrides.
 * @returns A persisted candidate comparison report without raw provider output.
 */
export async function runLocalModelCandidateEval(
  options: LocalModelCandidateEvalOptions,
): Promise<LocalModelCandidateEvalReport> {
  const startedAt = Date.now();
  const { appliedOverrides: baseOverrides, config } = applyLocalModelEvalOverrides(
    await loadConfig(),
    options.llmOverrides,
  );
  const candidates = await evaluateCandidates(config, baseOverrides, options.candidates);
  const recommendedCandidate = selectRecommendedLocalModelCandidate(candidates);
  const passed = candidates.length > 0 && candidates.every((candidate) => candidate.passed);
  const report: LocalModelCandidateEvalReport = {
    baseOverrides,
    candidates,
    configSource: baseOverrides.length > 0 ? "cli-overrides" : "project",
    createdAt: nowIso(),
    durationMs: Date.now() - startedAt,
    passed,
    providerMode: config.providers.llm.mode,
    operatorGuidance: localModelCandidateOperatorGuidance(
      config.providers.llm.mode,
      recommendedCandidate,
      passed,
    ),
    recommendedCandidate,
  };
  await writeJsonFile(localModelCandidateEvalJsonPath(), report);
  await writeTextFile(
    localModelCandidateEvalMarkdownPath(),
    renderLocalModelCandidateEvalMarkdown(report),
  );
  return report;
}

async function evaluateCandidates(
  config: ProducerConfig,
  baseOverrides: string[],
  candidates: string[],
): Promise<LocalModelEvalReport[]> {
  const uniqueCandidates = Array.from(new Set(candidates));
  const servedLlamaCppModels =
    config.providers.llm.mode === "llama.cpp" ? await readServedLlamaCppModels(config) : null;
  if (servedLlamaCppModels?.status === "block") {
    return uniqueCandidates.map((candidate) =>
      llamaCppDiagnosticFailureReport(
        config,
        baseOverrides,
        candidate,
        servedLlamaCppModels.message,
      ),
    );
  }
  const reports: LocalModelEvalReport[] = [];
  for (const candidate of uniqueCandidates) {
    if (
      servedLlamaCppModels?.status === "pass" &&
      !servedLlamaCppModels.models.includes(candidate)
    ) {
      reports.push(unservedLlamaCppCandidateReport(config, baseOverrides, candidate));
      continue;
    }
    reports.push(
      await runLocalModelEvalWithConfig(
        {
          ...config,
          providers: { ...config.providers, llm: { ...config.providers.llm, model: candidate } },
        },
        [...baseOverrides, "model"],
      ),
    );
  }
  return reports;
}

async function readServedLlamaCppModels(
  config: ProducerConfig,
): Promise<ServedLlamaCppModelsResult> {
  const diagnostic = await new LlamaCppProvider(
    config.providers.llm.llamaCppBaseUrl,
    config.providers.llm.model,
    config.providers.llm.requestTimeoutMs,
  ).diagnose();
  if (diagnostic.kind === "diagnostic-failure") {
    return { message: diagnostic.message, status: "block" };
  }
  return { models: diagnostic.servedModels, status: "pass" };
}

/**
 * Determines whether a candidate comparison should fail the CLI process.
 *
 * Mixed comparisons can still be useful when at least one candidate passes; those should remain
 * reviewable reports instead of hard command failures. The CLI fails only when no candidate is
 * ready and the operator needs to try more candidates.
 *
 * @param report - The completed candidate comparison report.
 * @returns True when the CLI should exit non-zero.
 */
export function localModelCandidateEvalRequiresMoreCandidates(
  report: LocalModelCandidateEvalReport,
): boolean {
  return report.operatorGuidance.decision === "try-more-candidates";
}

function localModelCandidateOperatorGuidance(
  providerMode: ProducerConfig["providers"]["llm"]["mode"],
  recommendation: LocalModelCandidateRecommendation | null,
  passed: boolean,
): LocalModelCandidateOperatorGuidance {
  if (recommendation) {
    return {
      decision: passed ? "candidate-ready" : "candidate-ready-with-blockers",
      message: passed
        ? "All compared candidates passed the parser-contract checks. Review the report, then run a single-model eval before changing producer.config.json."
        : "At least one candidate passed, but the comparison still has blocked candidates. Review blocked rows before changing producer.config.json.",
      nextCommand: `pnpm producer eval local-model --llm-mode ${shellQuote(
        providerMode,
      )} --model ${shellQuote(recommendation.configuredModel)}`,
    };
  }
  return {
    decision: "try-more-candidates",
    message:
      "No candidate passed all parser-contract checks. Keep the current project config unchanged and compare different local models or runtimes.",
    nextCommand: `pnpm producer eval local-model-candidates --llm-mode ${shellQuote(
      providerMode,
    )} --candidate <another-model>`,
  };
}
