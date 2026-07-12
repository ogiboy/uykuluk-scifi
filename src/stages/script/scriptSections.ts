import { z } from "zod";
import { SafeExitError } from "../../core/errors.js";
import { GenerateTextResult } from "../../providers/llmProvider.js";
import { sha256 } from "../../utils/hash.js";
import { parseProviderJson } from "../provider/providerJson.js";
import type { ScriptContentBlockerRetryEvidence } from "./scriptContentRetry.js";
import type { ScriptLabelRepairEvidence } from "./scriptLabelRepair.js";
import { repairScriptProductionLabels } from "./scriptLabelRepair.js";
import { stripLeadingMarkdownHeading } from "./scriptMarkdown.js";
import {
  renderPreviousExpansionContext,
  renderScopedScriptSectionContext,
} from "./scriptSectionPromptContext.js";

const scriptSectionPayloadSchema = z.strictObject({ text: z.string().min(1).max(750) });
const scriptSectionExpansionPayloadSchema = z.strictObject({ text: z.string().min(1).max(1400) });

export const scriptSectionResponseFormat = {
  type: "object",
  properties: { text: { type: "string", minLength: 1, maxLength: 750 } },
  required: ["text"],
} as const satisfies Record<string, unknown>;

export const scriptSectionExpansionResponseFormat = {
  type: "object",
  properties: { text: { type: "string", minLength: 1, maxLength: 1400 } },
  required: ["text"],
} as const satisfies Record<string, unknown>;

export type ScriptSectionPlan = {
  id: "hook" | "context" | "development" | "outro";
  heading: string;
  instruction: string;
};

export type ScriptSectionReceipt = {
  id: ScriptSectionPlan["id"];
  pass: "draft" | "expansion" | "continuation";
  chunk?: number;
  heading: string;
  promptHash: string;
  contentHash: string;
  wordCount: number;
  provider: string;
  model: string;
  blockerRetry?: ScriptContentBlockerRetryEvidence;
  labelRepair?: ScriptLabelRepairEvidence;
  inputTokensApprox?: number;
  outputTokensApprox?: number;
  durationMs: number;
};

export type ScriptSectionParseResult = { labelRepair?: ScriptLabelRepairEvidence; text: string };

export const scriptSectionPlans: ScriptSectionPlan[] = [
  {
    id: "hook",
    heading: "Açılış",
    instruction: "Merak uyandıran Türkçe açılış hook'u, temel soru ve atmosfer.",
  },
  {
    id: "context",
    heading: "Bilimsel Bağlam",
    instruction: "Bilimsel ihtiyat, olasılıklar, sınırlılıklar ve anlaşılır arka plan.",
  },
  {
    id: "development",
    heading: "Sinematik Gelişme",
    instruction: "Ana anlatı gelişimi, görsel ritim önerileri ve sakin dramatik yükseliş.",
  },
  {
    id: "outro",
    heading: "Kapanış",
    instruction: "Toparlama, temkinli sonuç, UykulukSciFi tonunda nazik kapanış çağrısı.",
  },
];

export type ScriptSectionExpansionChunk = { index: 1 | 2 | 3; focus: string };

export const scriptSectionExpansionChunks: ScriptSectionExpansionChunk[] = [
  { index: 1, focus: "strong image, hook continuity, and scene-setting narration" },
  { index: 2, focus: "scientific framing, uncertainty, alternatives, and responsible speculation" },
  { index: 3, focus: "cinematic transition, emotional rhythm, and section-level closure" },
];

export function renderScriptSectionPrompt(basePrompt: string, section: ScriptSectionPlan): string {
  return [
    "SCRIPT_SECTION_JSON",
    renderScopedScriptSectionContext(basePrompt),
    "## Section Contract",
    `Section id: ${section.id}`,
    `Section heading: ${section.heading}`,
    `Section instruction: ${section.instruction}`,
    "Target length: 50-90 kelime.",
    "Tek paragraf yaz; en fazla 4 cümle kur, ikinci paragraf yazma ve tekrar etme.",
    "Return this section's complete Turkish narration inside a JSON object.",
    'Use this exact shape: {"text":"..."}',
    "Do not include a top-level title.",
    "Use Turkish labels only: Anlatıcı: and Görsel:. Write labels as plain text without backticks.",
    "End the section with a complete sentence; yarım cümleyle bitirme.",
    "Return only the final JSON payload. Do not include markdown fences, commentary, or thinking traces.",
  ].join("\n\n");
}

export function renderScriptSectionExpansionPrompt(
  basePrompt: string,
  section: ScriptSectionPlan,
  draft: string,
  chunk: ScriptSectionExpansionChunk = scriptSectionExpansionChunks[0],
  previousChunks: readonly string[] = [],
): string {
  return [
    "SCRIPT_SECTION_JSON",
    renderScopedScriptSectionContext(basePrompt),
    "## Section Expansion Contract",
    `Section id: ${section.id}`,
    `Section heading: ${section.heading}`,
    `Section instruction: ${section.instruction}`,
    `Expansion chunk: ${chunk.index}/${scriptSectionExpansionChunks.length}`,
    `Chunk focus: ${chunk.focus}.`,
    "Write only this chunk for this one section. Do not write the full script.",
    "Target length: 110-150 Turkish words.",
    "Hard limit: 1200 characters.",
    "Write exactly 5 complete Turkish sentences; if you need labels, keep them inside those five sentences.",
    "Sentence plan: 1) concrete visual or narrative beat; 2) cause, measurement, or uncertainty; 3) distinct consequence or decision; 4) added scene texture; 5) transition or closure.",
    "Keep complete sentences, no repeated sentence loops.",
    "Each sentence must add a new concrete beat; do not recycle the same subject-verb-object pattern.",
    "Do not start two sentences with the same first four words.",
    "Avoid generic filler openers such as `Bu ritim`, `Bu sahne`, `Bu yolculuk`, and `Bu bölüm`.",
    "Before returning, compare this chunk against the draft and already-written chunks; replace repeated structures with new images or decisions.",
    "The draft remains in the final script. Add new material instead of restating or paraphrasing it.",
    "Add richer narration, visual rhythm, and careful scientific framing without duplicating the draft.",
    section.id === "hook" ? "Start with a strong Turkish hook question or image." : "",
    section.id === "outro" ? "End with a gentle UykulukSciFi call to action." : "",
    renderPreviousExpansionContext(previousChunks),
    'Return only JSON with this exact shape: {"text":"..."}',
    "End the JSON object immediately after the final complete sentence.",
    "## Draft",
    draft,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function sectionTokenCap(totalScriptCap: number): number {
  return Math.max(500, Math.ceil(totalScriptCap / scriptSectionPlans.length / 3));
}

export function sectionExpansionTokenCap(totalScriptCap: number): number {
  return Math.max(
    1000,
    Math.ceil(totalScriptCap / scriptSectionPlans.length / scriptSectionExpansionChunks.length),
  );
}

export function createScriptSectionReceipt(
  section: ScriptSectionPlan,
  pass: ScriptSectionReceipt["pass"],
  prompt: string,
  text: string,
  result: GenerateTextResult,
  chunk?: number,
  labelRepair?: ScriptLabelRepairEvidence,
): ScriptSectionReceipt {
  return {
    id: section.id,
    pass,
    chunk,
    heading: section.heading,
    promptHash: sha256(prompt),
    contentHash: sha256(text),
    wordCount: countWords(text),
    provider: result.provider,
    model: result.model,
    labelRepair,
    inputTokensApprox: result.inputTokensApprox,
    outputTokensApprox: result.outputTokensApprox,
    durationMs: result.durationMs,
  };
}

export function parseScriptSectionProviderPayload(text: string): string {
  return parseScriptSectionProviderPayloadWithRepair(text).text;
}

export function parseScriptSectionExpansionProviderPayload(text: string): string {
  return parseScriptSectionExpansionProviderPayloadWithRepair(text).text;
}

export function parseScriptSectionProviderPayloadWithRepair(
  text: string,
): ScriptSectionParseResult {
  return parseScriptSectionPayload(text, scriptSectionPayloadSchema);
}

export function parseScriptSectionExpansionProviderPayloadWithRepair(
  text: string,
): ScriptSectionParseResult {
  return parseScriptSectionPayload(text, scriptSectionExpansionPayloadSchema);
}

function parseScriptSectionPayload(
  text: string,
  schema: z.ZodType<{ text: string }>,
): ScriptSectionParseResult {
  const result = schema.safeParse(parseProviderJson(text, "script section"));
  if (!result.success) {
    const summary = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid script section provider response: ${summary}`);
  }
  const trimmed = trimToLastCompleteSentence(result.data.text.trim());
  if (!trimmed) {
    throw new SafeExitError(
      "Invalid script section provider response: section has no complete sentence.",
    );
  }
  return repairScriptProductionLabels(trimmed);
}

export function assembleScriptFromSections(
  title: string,
  sections: Array<{ heading: string; text: string }>,
): string {
  return [
    `# ${title}`,
    ...sections.flatMap((section) => [
      "",
      `## ${section.heading}`,
      "",
      stripLeadingMarkdownHeading(section.text),
    ]),
  ].join("\n");
}

function trimToLastCompleteSentence(text: string): string {
  const matches = [...text.matchAll(/[.!?…](?=\s|$)/g)];
  const last = matches.at(-1);
  return last ? text.slice(0, last.index + 1).trim() : "";
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
