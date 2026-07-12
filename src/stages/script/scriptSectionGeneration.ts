import type { ProducerConfig } from "../../config/schema.js";
import { SafeExitError } from "../../core/errors.js";
import type { LlmProvider } from "../../providers/llmProvider.js";
import { stripProviderThinking } from "../provider/providerPayloads.js";
import {
  generateScriptContentWithBlockerRetry,
  type ScriptContentBlockerRetryEvidence,
} from "./scriptContentRetry.js";
import {
  createScriptSectionReceipt,
  parseScriptSectionExpansionProviderPayloadWithRepair,
  parseScriptSectionProviderPayloadWithRepair,
  renderScriptSectionExpansionPrompt,
  renderScriptSectionPrompt,
  scriptSectionExpansionChunks,
  scriptSectionExpansionResponseFormat,
  scriptSectionPlans,
  scriptSectionResponseFormat,
  sectionExpansionTokenCap,
  sectionTokenCap,
  type ScriptSectionParseResult,
  type ScriptSectionReceipt,
} from "./scriptSections.js";

export type ScriptSectionOutput = { heading: string; text: string };

export type GeneratedScriptSections = {
  promptTexts: string[];
  sectionOutputs: ScriptSectionOutput[];
  sectionReceipts: ScriptSectionReceipt[];
};

export async function generateScriptSections(input: {
  basePrompt: string;
  config: ProducerConfig;
  provider: LlmProvider;
}): Promise<GeneratedScriptSections> {
  const sectionOutputs: ScriptSectionOutput[] = [];
  const sectionReceipts: ScriptSectionReceipt[] = [];
  const promptTexts: string[] = [];
  const sectionCap = sectionTokenCap(input.config.providers.llm.maxOutputTokens.script);
  const expansionCap = sectionExpansionTokenCap(input.config.providers.llm.maxOutputTokens.script);

  for (const section of scriptSectionPlans) {
    const sectionPrompt = renderScriptSectionPrompt(input.basePrompt, section);
    const draftAttempt = await generateScriptContentWithBlockerRetry({
      parse: (text) =>
        parseSectionProviderPayload(
          text,
          parseScriptSectionProviderPayloadWithRepair,
          section.id,
          "draft",
        ),
      prompt: sectionPrompt,
      provider: input.provider,
      request: {
        model: input.config.providers.llm.model,
        temperature: 0.6,
        maxTokens: sectionCap,
        responseFormat: scriptSectionResponseFormat,
      },
      source: `script section draft provider response for ${section.id}`,
      textOf: (parsed) => parsed.text,
      validationContext: scriptValidationContext(sectionOutputs),
    });
    promptTexts.push(...draftAttempt.prompts);
    const draft = draftAttempt.parsed;
    sectionReceipts.push(
      withBlockerRetry(
        createScriptSectionReceipt(
          section,
          "draft",
          draftAttempt.prompts.at(-1) ?? sectionPrompt,
          draft.text,
          draftAttempt.result,
          undefined,
          draft.labelRepair,
        ),
        draftAttempt.blockerRetry,
      ),
    );
    const expandedChunks: string[] = [];
    for (const chunk of scriptSectionExpansionChunks) {
      const expansionPrompt = renderScriptSectionExpansionPrompt(
        input.basePrompt,
        section,
        draft.text,
        chunk,
        expandedChunks,
      );
      const expansionAttempt = await generateScriptContentWithBlockerRetry({
        parse: (text) =>
          parseSectionProviderPayload(
            text,
            parseScriptSectionExpansionProviderPayloadWithRepair,
            section.id,
            `expansion chunk ${chunk.index}`,
          ),
        prompt: expansionPrompt,
        provider: input.provider,
        request: {
          model: input.config.providers.llm.model,
          temperature: 0.4,
          maxTokens: expansionCap,
          responseFormat: scriptSectionExpansionResponseFormat,
        },
        source: `script section expansion chunk ${chunk.index} provider response for ${section.id}`,
        textOf: (parsed) => parsed.text,
        validationContext: scriptValidationContext([
          ...sectionOutputs,
          { heading: section.heading, text: [draft.text, ...expandedChunks].join("\n\n") },
        ]),
      });
      promptTexts.push(...expansionAttempt.prompts);
      const expanded = expansionAttempt.parsed;
      expandedChunks.push(expanded.text);
      sectionReceipts.push(
        withBlockerRetry(
          createScriptSectionReceipt(
            section,
            "expansion",
            expansionAttempt.prompts.at(-1) ?? expansionPrompt,
            expanded.text,
            expansionAttempt.result,
            chunk.index,
            expanded.labelRepair,
          ),
          expansionAttempt.blockerRetry,
        ),
      );
    }
    sectionOutputs.push({
      heading: section.heading,
      text: [draft.text, ...expandedChunks].join("\n\n"),
    });
  }
  return { promptTexts, sectionOutputs, sectionReceipts };
}

export function sectionProviderCallCount(
  receipts: Array<{ blockerRetry?: ScriptContentBlockerRetryEvidence }>,
): number {
  return receipts.reduce((sum, receipt) => sum + (receipt.blockerRetry?.attemptCount ?? 1), 0);
}

export function receiptInputTokens(receipt: {
  blockerRetry?: ScriptContentBlockerRetryEvidence;
  inputTokensApprox?: number;
}): number | undefined {
  return sumOptionalNumbers([
    ...rejectedAttemptValues(receipt.blockerRetry, "inputTokensApprox"),
    receipt.inputTokensApprox,
  ]);
}

export function receiptOutputTokens(receipt: {
  blockerRetry?: ScriptContentBlockerRetryEvidence;
  outputTokensApprox?: number;
}): number | undefined {
  return sumOptionalNumbers([
    ...rejectedAttemptValues(receipt.blockerRetry, "outputTokensApprox"),
    receipt.outputTokensApprox,
  ]);
}

export function receiptDurationMs(receipt: {
  blockerRetry?: ScriptContentBlockerRetryEvidence;
  durationMs: number;
}): number {
  return (
    (receipt.blockerRetry?.rejectedAttempts ?? []).reduce(
      (sum, attempt) => sum + attempt.durationMs,
      0,
    ) + receipt.durationMs
  );
}

function parseSectionProviderPayload(
  text: string,
  parser: (text: string) => ScriptSectionParseResult,
  sectionId: string,
  pass: string,
): ScriptSectionParseResult {
  try {
    const result = parser(text);
    return { ...result, text: stripProviderThinking(result.text) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SafeExitError(
      `Invalid script section ${pass} provider response for ${sectionId}: ${stripScriptSectionErrorPrefix(
        message,
      )}`,
    );
  }
}

function stripScriptSectionErrorPrefix(message: string): string {
  const prefix = "Invalid script section provider response: ";
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

function scriptValidationContext(sections: Array<{ text: string }>): string | undefined {
  const text = sections
    .map((section) => section.text)
    .filter(Boolean)
    .join("\n\n");
  return text || undefined;
}

function withBlockerRetry<T extends object>(
  receipt: T,
  blockerRetry?: ScriptContentBlockerRetryEvidence,
): T {
  return blockerRetry ? { ...receipt, blockerRetry } : receipt;
}

function sumOptionalNumbers(values: Array<number | undefined>): number | undefined {
  return values.every((value): value is number => typeof value === "number")
    ? values.reduce((sum, value) => sum + value, 0)
    : undefined;
}

function rejectedAttemptValues(
  blockerRetry: ScriptContentBlockerRetryEvidence | undefined,
  key: "inputTokensApprox" | "outputTokensApprox",
): Array<number | undefined> {
  return (blockerRetry?.rejectedAttempts ?? []).map((attempt) => attempt[key]);
}
