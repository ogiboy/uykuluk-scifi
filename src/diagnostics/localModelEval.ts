import path from "node:path";
import { loadConfig } from "../config/config.js";
import { ProducerConfig } from "../config/schema.js";
import { createLlmProvider } from "../providers/index.js";
import { GenerateTextResult, LlmProvider } from "../providers/llmProvider.js";
import { parseIdeasProviderPayload } from "../stages/providerPayloads.js";
import { ideasResponseFormat } from "../stages/providerResponseFormats.js";
import { writeTextFile } from "../utils/fs.js";
import { sha256 } from "../utils/hash.js";
import { writeJsonFile } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import {
  applyLocalModelEvalOverrides,
  LocalModelEvalLlmOverrides,
} from "./localModelEvalConfig.js";
import { renderLocalModelEvalMarkdown } from "./localModelEvalFormatting.js";
import { renderIdeaEvalPrompt } from "./localModelEvalPrompts.js";
import {
  maxOutputTokensForEvalCheck,
  safeLocalModelEvalErrorMessage,
} from "./localModelEvalSafety.js";
import { evaluateScriptSectionChecks } from "./localModelEvalScriptSection.js";

export type LocalModelEvalCheck = {
  name: "ideas-json" | "script-quality-guard" | "script-section-json";
  status: "pass" | "block";
  message: string;
  provider?: string;
  model?: string;
  promptHash?: string;
  outputHash?: string;
  outputTokensApprox?: number;
  inputTokensApprox?: number;
  durationMs?: number;
};

export type LocalModelEvalReport = {
  appliedOverrides: string[];
  configSource: "cli-overrides" | "project";
  createdAt: string;
  durationMs: number;
  providerMode: ProducerConfig["providers"]["llm"]["mode"];
  configuredModel: string;
  passed: boolean;
  checks: LocalModelEvalCheck[];
};

export type LocalModelEvalOptions = {
  llmOverrides?: LocalModelEvalLlmOverrides;
};

/**
 * Gets the absolute path to the local model evaluation JSON report.
 *
 * @returns The absolute path to `diagnostics/local_model_eval.json`.
 */
export function localModelEvalJsonPath(): string {
  return path.join(process.cwd(), "diagnostics", "local_model_eval.json");
}

/**
 * Gets the absolute path to the local model evaluation Markdown report.
 *
 * @returns The absolute path to `diagnostics/local_model_eval.md`.
 */
export function localModelEvalMarkdownPath(): string {
  return path.join(process.cwd(), "diagnostics", "local_model_eval.md");
}

/**
 * Runs a small local-provider evaluation without storing raw model output.
 *
 * The evaluation uses the same production parsers for idea JSON and script section JSON so local
 * model candidates can be compared before treating any one runtime/model as production-ready.
 *
 * @returns A persisted local model evaluation report.
 */
export async function runLocalModelEval(
  options: LocalModelEvalOptions = {},
): Promise<LocalModelEvalReport> {
  const { appliedOverrides, config } = applyLocalModelEvalOverrides(
    await loadConfig(),
    options.llmOverrides,
  );
  const report = await runLocalModelEvalWithConfig(config, appliedOverrides);
  await writeJsonFile(localModelEvalJsonPath(), report);
  await writeTextFile(localModelEvalMarkdownPath(), renderLocalModelEvalMarkdown(report));
  return report;
}

/**
 * Evaluates a concrete local model configuration without writing report artifacts.
 *
 * @param config - The exact provider configuration to evaluate.
 * @param appliedOverrides - Stable override keys that explain how this config was derived.
 * @returns The local model evaluation report.
 */
export async function runLocalModelEvalWithConfig(
  config: ProducerConfig,
  appliedOverrides: string[],
): Promise<LocalModelEvalReport> {
  const startedAt = Date.now();
  const provider = createLlmProvider(config);
  const ideasCheck = await evaluateIdeas(provider, config);
  const scriptChecks = await evaluateScriptSectionChecks(provider, config);
  const checks = [ideasCheck, ...scriptChecks];
  const report: LocalModelEvalReport = {
    appliedOverrides,
    configSource: appliedOverrides.length > 0 ? "cli-overrides" : "project",
    createdAt: nowIso(),
    durationMs: Date.now() - startedAt,
    providerMode: config.providers.llm.mode,
    configuredModel: config.providers.llm.model,
    passed: checks.every((check) => check.status === "pass"),
    checks,
  };
  return report;
}

async function evaluateIdeas(
  provider: LlmProvider,
  config: ProducerConfig,
): Promise<LocalModelEvalCheck> {
  const prompt = renderIdeaEvalPrompt();
  const result = await requestProvider(provider, config, prompt, "ideas-json", {
    responseFormat: ideasResponseFormat,
  });
  if (!result.ok) {
    return result.check;
  }
  try {
    const ideas = parseIdeasProviderPayload(result.result.text);
    return passingCheck("ideas-json", prompt, result.result, `${ideas.length} ideas parsed.`);
  } catch (error) {
    return blockingCheck(
      "ideas-json",
      prompt,
      result.result,
      safeLocalModelEvalErrorMessage(error),
    );
  }
}

type ProviderRequestResult =
  | { ok: true; result: GenerateTextResult }
  | { check: LocalModelEvalCheck; ok: false };

async function requestProvider(
  provider: LlmProvider,
  config: ProducerConfig,
  prompt: string,
  name: LocalModelEvalCheck["name"],
  options: { responseFormat: "json" | Record<string, unknown> },
): Promise<ProviderRequestResult> {
  try {
    const result = await provider.generateText({
      model: config.providers.llm.model,
      prompt,
      maxTokens: maxOutputTokensForEvalCheck(config, name),
      temperature: 0.2,
      responseFormat: options.responseFormat,
    });
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      check: {
        name,
        status: "block",
        message: safeLocalModelEvalErrorMessage(error),
        promptHash: sha256(prompt),
      },
    };
  }
}

function passingCheck(
  name: LocalModelEvalCheck["name"],
  prompt: string,
  result: GenerateTextResult,
  message: string,
): LocalModelEvalCheck {
  return {
    name,
    status: "pass",
    message,
    provider: result.provider,
    model: result.model,
    promptHash: sha256(prompt),
    outputHash: sha256(result.text),
    inputTokensApprox: result.inputTokensApprox,
    outputTokensApprox: result.outputTokensApprox,
    durationMs: result.durationMs,
  };
}

function blockingCheck(
  name: LocalModelEvalCheck["name"],
  prompt: string,
  result: GenerateTextResult,
  message: string,
): LocalModelEvalCheck {
  return {
    ...passingCheck(name, prompt, result, message),
    status: "block",
  };
}
