import type { ProducerConfig } from "../config/schema.js";
import type { GenerateTextResult, LlmProvider } from "../providers/llmProvider.js";
import { reviewScriptContent } from "../safeguards/contentGuard.js";
import {
  parseScriptSectionProviderPayload,
  renderScriptSectionPrompt,
  scriptSectionPlans,
  scriptSectionResponseFormat,
} from "../stages/scriptSections.js";
import { sha256 } from "../utils/hash.js";
import type { LocalModelEvalCheck } from "./localModelEval.js";
import { renderScriptEvalBasePrompt } from "./localModelEvalPrompts.js";
import {
  maxOutputTokensForEvalCheck,
  safeLocalModelEvalErrorMessage,
} from "./localModelEvalSafety.js";

export async function evaluateScriptSectionChecks(
  provider: LlmProvider,
  config: ProducerConfig,
): Promise<LocalModelEvalCheck[]> {
  const prompt = renderScriptSectionPrompt(renderScriptEvalBasePrompt(), scriptSectionPlans[0]);
  try {
    const result = await provider.generateText({
      model: config.providers.llm.model,
      prompt,
      maxTokens: maxOutputTokensForEvalCheck(config, "script-section-json"),
      temperature: 0.2,
      responseFormat: scriptSectionResponseFormat,
    });
    return scriptSectionChecksFromResult(prompt, result);
  } catch (error) {
    return [
      {
        name: "script-section-json",
        status: "block",
        message: safeLocalModelEvalErrorMessage(error),
        promptHash: sha256(prompt),
      },
      {
        name: "script-quality-guard",
        status: "block",
        message: "Skipped because script-section-json blocked.",
        promptHash: sha256(prompt),
      },
    ];
  }
}

function scriptSectionChecksFromResult(
  prompt: string,
  result: GenerateTextResult,
): LocalModelEvalCheck[] {
  try {
    const text = parseScriptSectionProviderPayload(result.text);
    return [
      passingCheck("script-section-json", prompt, result, `${countWords(text)} words parsed.`),
      evaluateScriptQualityGuard(prompt, result, text),
    ];
  } catch (error) {
    return [
      blockingCheck("script-section-json", prompt, result, safeLocalModelEvalErrorMessage(error)),
      {
        ...passingCheck(
          "script-quality-guard",
          prompt,
          result,
          "Skipped because script-section-json could not be parsed.",
        ),
        status: "block",
      },
    ];
  }
}

function evaluateScriptQualityGuard(
  prompt: string,
  result: GenerateTextResult,
  text: string,
): LocalModelEvalCheck {
  const blockers = reviewScriptContent(text).filter((warning) => warning.severity === "blocker");
  if (blockers.length === 0) {
    return passingCheck(
      "script-quality-guard",
      prompt,
      result,
      "Script section passed production content blockers.",
    );
  }
  return blockingCheck(
    "script-quality-guard",
    prompt,
    result,
    `Script quality blockers: ${blockers.map((blocker) => blocker.code).join(", ")}.`,
  );
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

function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}
