import path from "node:path";
import { loadConfig } from "../config/config.js";
import { ProducerConfig } from "../config/schema.js";
import { writeTextFile } from "../utils/fs.js";
import { nowIso } from "../utils/time.js";
import { writeJsonFile } from "../utils/json.js";
import {
  applyLocalModelEvalOverrides,
  LocalModelEvalLlmOverrides,
} from "./localModelEvalConfig.js";
import { LocalModelEvalReport, runLocalModelEvalWithConfig } from "./localModelEval.js";
import { renderLocalModelCandidateEvalMarkdown } from "./localModelCandidateEvalFormatting.js";

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
  recommendedCandidate: LocalModelCandidateRecommendation | null;
};

export type LocalModelCandidateRecommendation = {
  blockedChecks: number;
  configuredModel: string;
  durationMs: number;
  passedChecks: number;
};

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
  const report: LocalModelCandidateEvalReport = {
    baseOverrides,
    candidates,
    configSource: baseOverrides.length > 0 ? "cli-overrides" : "project",
    createdAt: nowIso(),
    durationMs: Date.now() - startedAt,
    passed: candidates.every((candidate) => candidate.passed),
    providerMode: config.providers.llm.mode,
    recommendedCandidate: selectRecommendedLocalModelCandidate(candidates),
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
  const reports: LocalModelEvalReport[] = [];
  for (const candidate of uniqueCandidates) {
    reports.push(
      await runLocalModelEvalWithConfig(
        {
          ...config,
          providers: {
            ...config.providers,
            llm: {
              ...config.providers.llm,
              model: candidate,
            },
          },
        },
        [...baseOverrides, "model"],
      ),
    );
  }
  return reports;
}

/**
 * Selects the strongest passing candidate from a local model comparison report.
 *
 * @param candidates - Evaluated model candidates.
 * @returns The deterministic recommendation summary, or `null` when no candidate passed.
 */
export function selectRecommendedLocalModelCandidate(
  candidates: LocalModelEvalReport[],
): LocalModelCandidateRecommendation | null {
  const passingCandidates = candidates.flatMap((candidate) =>
    candidate.passed ? [candidateRecommendationSummary(candidate)] : [],
  );
  if (passingCandidates.length === 0) {
    return null;
  }
  return [...passingCandidates].sort(candidateRecommendationSort)[0] ?? null;
}

function candidateRecommendationSummary(
  candidate: LocalModelEvalReport,
): LocalModelCandidateRecommendation {
  return {
    blockedChecks: candidate.checks.filter((check) => check.status === "block").length,
    configuredModel: candidate.configuredModel,
    durationMs: candidate.durationMs,
    passedChecks: candidate.checks.filter((check) => check.status === "pass").length,
  };
}

function candidateRecommendationSort(
  left: LocalModelCandidateRecommendation,
  right: LocalModelCandidateRecommendation,
): number {
  return (
    right.passedChecks - left.passedChecks ||
    left.blockedChecks - right.blockedChecks ||
    left.durationMs - right.durationMs ||
    left.configuredModel.localeCompare(right.configuredModel)
  );
}
