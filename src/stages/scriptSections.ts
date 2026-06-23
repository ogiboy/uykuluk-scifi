import { z } from "zod";
import { GenerateTextResult } from "../providers/llmProvider.js";
import { SafeExitError } from "../core/errors.js";
import { parseProviderJson } from "./providerJson.js";
import { sha256 } from "../utils/hash.js";

const scriptSectionPayloadSchema = z.strictObject({
  text: z.string().min(1).max(750),
});

export const scriptSectionResponseFormat = {
  type: "object",
  properties: {
    text: { type: "string", minLength: 1, maxLength: 750 },
  },
  required: ["text"],
} as const satisfies Record<string, unknown>;

export type ScriptSectionPlan = {
  id: "hook" | "context" | "development" | "outro";
  heading: string;
  instruction: string;
};

export type ScriptSectionReceipt = {
  id: ScriptSectionPlan["id"];
  heading: string;
  promptHash: string;
  contentHash: string;
  wordCount: number;
  provider: string;
  model: string;
  inputTokensApprox?: number;
  outputTokensApprox?: number;
  durationMs: number;
};

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

export function renderScriptSectionPrompt(basePrompt: string, section: ScriptSectionPlan): string {
  return [
    "SCRIPT_SECTION_JSON",
    basePrompt,
    "## Section Contract",
    `Section id: ${section.id}`,
    `Section heading: ${section.heading}`,
    `Section instruction: ${section.instruction}`,
    "Target length: 50-90 kelime.",
    "Tek paragraf yaz; en fazla 4 cümle kur, ikinci paragraf yazma ve tekrar etme.",
    "Return this section's complete Turkish narration inside a JSON object.",
    'Use this exact shape: {"text":"..."}',
    "Do not include a top-level title.",
    "Use Turkish labels only, for example `Anlatıcı:` and `Görsel:`.",
    "End the section with a complete sentence; yarım cümleyle bitirme.",
    "Return only the final JSON payload. Do not include markdown fences, commentary, or thinking traces.",
  ].join("\n\n");
}

export function sectionTokenCap(totalScriptCap: number): number {
  return Math.max(500, Math.ceil(totalScriptCap / scriptSectionPlans.length / 3));
}

export function createScriptSectionReceipt(
  section: ScriptSectionPlan,
  prompt: string,
  text: string,
  result: GenerateTextResult,
): ScriptSectionReceipt {
  return {
    id: section.id,
    heading: section.heading,
    promptHash: sha256(prompt),
    contentHash: sha256(text),
    wordCount: countWords(text),
    provider: result.provider,
    model: result.model,
    inputTokensApprox: result.inputTokensApprox,
    outputTokensApprox: result.outputTokensApprox,
    durationMs: result.durationMs,
  };
}

export function parseScriptSectionProviderPayload(text: string): string {
  const result = scriptSectionPayloadSchema.safeParse(parseProviderJson(text, "script section"));
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
  return trimmed;
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

function stripLeadingMarkdownHeading(text: string): string {
  return text
    .trim()
    .replace(/^#{1,3}\s+.+(?:\n+|$)/, "")
    .trim();
}

function trimToLastCompleteSentence(text: string): string {
  const matches = [...text.matchAll(/[.!?…](?=\s|$)/g)];
  const last = matches.at(-1);
  return last ? text.slice(0, last.index + 1).trim() : "";
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
