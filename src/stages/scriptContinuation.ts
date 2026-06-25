import type { ProducerConfig } from "../config/schema.js";
import { SafeExitError } from "../core/errors.js";
import type { LlmProvider } from "../providers/llmProvider.js";
import { parseScriptContinuationProviderPayload } from "./scriptContinuationParsing.js";
import { generateScriptContentWithBlockerRetry } from "./scriptContentRetry.js";
import {
  assembleScriptFromSections,
  createScriptSectionReceipt,
  scriptSectionPlans,
  type ScriptSectionReceipt,
} from "./scriptSections.js";

type ScriptSectionOutput = {
  heading: string;
  text: string;
};

type ScriptContinuationInput = {
  basePrompt: string;
  config: ProducerConfig;
  provider: LlmProvider;
  promptTexts: string[];
  sectionOutputs: ScriptSectionOutput[];
  sectionReceipts: ScriptSectionReceipt[];
  title: string;
};

type ScriptContinuationChunk = {
  focus: string;
  index: 1 | 2;
};

export const longFormWordFloor = 1200;
const developmentSectionId = "development";
const developmentPlan = scriptSectionPlans.find((section) => section.id === developmentSectionId);
export const scriptContinuationResponseFormat = {
  type: "object",
  properties: {
    text: { type: "string", minLength: 1 },
  },
  required: ["text"],
} as const satisfies Record<string, unknown>;

export const scriptContinuationChunks: ScriptContinuationChunk[] = [
  {
    index: 1,
    focus: "deepen the central cinematic development and add concrete visual rhythm",
  },
  {
    index: 2,
    focus: "add scientific caution, alternatives, and a smoother bridge into the outro",
  },
];

export async function applyLongFormContinuations(input: ScriptContinuationInput): Promise<void> {
  const targetSection = input.sectionOutputs.find(
    (section) => section.heading === developmentPlan?.heading,
  );
  if (!targetSection || !developmentPlan) {
    return;
  }
  for (const chunk of scriptContinuationChunks) {
    const currentScript = assembleScriptFromSections(input.title, input.sectionOutputs);
    const missingWords = longFormWordFloor - countWords(currentScript);
    if (missingWords <= 0) {
      return;
    }
    const continuationPrompt = renderScriptContinuationPrompt(currentScript, input.basePrompt, {
      chunk,
      missingWords,
    });
    input.promptTexts.push(continuationPrompt);
    const continuationAttempt = await generateScriptContentWithBlockerRetry({
      parse: (text) => parseContinuationChunkPayload(text, chunk),
      prompt: continuationPrompt,
      provider: input.provider,
      request: {
        model: input.config.providers.llm.model,
        temperature: 0.35,
        maxTokens: scriptContinuationTokenCap(input.config.providers.llm.maxOutputTokens.script),
        responseFormat: scriptContinuationResponseFormat,
      },
      source: `script continuation chunk ${chunk.index} provider response`,
      textOf: (parsed) => parsed,
      validationContext: currentScript,
    });
    input.promptTexts.push(...continuationAttempt.prompts.slice(1));
    const continuation = continuationAttempt.parsed;
    targetSection.text = `${targetSection.text}\n\n${continuation}`;
    input.sectionReceipts.push({
      ...createScriptSectionReceipt(
        developmentPlan,
        "continuation",
        continuationAttempt.prompts.at(-1) ?? continuationPrompt,
        continuation,
        continuationAttempt.result,
        chunk.index,
      ),
      ...(continuationAttempt.blockerRetry
        ? { blockerRetry: continuationAttempt.blockerRetry }
        : {}),
    });
  }
}

export function assertLongFormWordFloor(script: string): void {
  const wordCount = countWords(script);
  if (wordCount < longFormWordFloor) {
    throw new SafeExitError(
      `Invalid assembled script provider response: remains below the long-form floor after bounded continuation passes (${wordCount}/${longFormWordFloor} words).`,
    );
  }
}

function parseContinuationChunkPayload(text: string, chunk: ScriptContinuationChunk): string {
  try {
    return parseScriptContinuationProviderPayload(text);
  } catch (error) {
    throw new SafeExitError(
      `Invalid script continuation chunk ${chunk.index} provider response: ${stripContinuationErrorPrefix(
        error instanceof Error ? error.message : String(error),
      )}`,
    );
  }
}

export function renderScriptContinuationPrompt(
  currentScript: string,
  basePrompt: string,
  options: { chunk: ScriptContinuationChunk; missingWords: number },
): string {
  return [
    "SCRIPT_CONTINUATION_JSON",
    "You are extending an already generated Turkish UykulukSciFi script.",
    "Return only new Turkish narration paragraphs for the existing `Sinematik Gelişme` section.",
    "Do not rewrite the title, headings, previous sections, outro, metadata, or JSON shape.",
    `Continuation chunk: ${options.chunk.index}/${scriptContinuationChunks.length}`,
    `Chunk focus: ${options.chunk.focus}.`,
    `Current missing long-form floor estimate: ${Math.max(0, options.missingWords)} words.`,
    "Target length: 260-340 Turkish words.",
    "Keep complete sentences, calm cinematic pacing, scientific caution, and Turkish production labels only.",
    "Spell production labels exactly as `Anlatıcı:` and `Görsel:`.",
    "Do not repeat any sentence or visual direction already present in the current script.",
    "Treat invented mechanisms as speculative fiction or open questions, not established science.",
    'Return only JSON with this exact shape: {"text":"..."}',
    "## Approved Idea Context",
    extractApprovedIdeaBlock(basePrompt),
    "## Current Script",
    currentScript,
  ].join("\n\n");
}

export { parseScriptContinuationProviderPayload } from "./scriptContinuationParsing.js";

export function scriptContinuationTokenCap(totalScriptCap: number): number {
  return Math.min(totalScriptCap, Math.max(1100, Math.ceil(totalScriptCap / 3)));
}

function extractApprovedIdeaBlock(basePrompt: string): string {
  const marker = "## Approved Idea";
  const markerIndex = basePrompt.indexOf(marker);
  return markerIndex >= 0 ? basePrompt.slice(markerIndex).trim() : basePrompt.trim();
}

function stripContinuationErrorPrefix(message: string): string {
  const prefix = "Invalid script continuation provider response: ";
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
