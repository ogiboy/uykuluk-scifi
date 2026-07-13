import { z } from "zod";
import { sha256 } from "../../utils/hash.js";
import { nowIso } from "../../utils/time.js";
import { digestSchema } from "../render/renderPlanSchemas.js";

export const voiceoverPreparedTextPath = "production/audio/voiceover.prepared.txt";
export const voiceoverPreparationPath = "production/audio/voiceover.preparation.json";

const appliedReplacementSchema = z.strictObject({
  source: z.string().min(1),
  replacement: z.string().min(1),
  count: z.int().positive(),
});

export const voiceoverPreparationSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  source: z.strictObject({ path: z.literal("production/voiceover.txt"), sha256: digestSchema }),
  output: z.strictObject({
    path: z.literal(voiceoverPreparedTextPath),
    sha256: digestSchema,
    characterCount: z.int().positive(),
  }),
  replacements: z.array(appliedReplacementSchema),
});

export type VoiceoverPreparation = z.infer<typeof voiceoverPreparationSchema>;

/**
 * Prepares narration text for text-to-speech using explicit pronunciation replacements.
 *
 * Replacements are case-sensitive and applied longest-key-first. The result includes metadata
 * describing the source, output, and replacements that were applied.
 *
 * @param input - The narration source, run identifier, and pronunciation replacements.
 * @returns The prepared text, validated preparation evidence, and its formatted JSON representation.
 */
export function prepareVoiceoverText(input: {
  runId: string;
  sourceText: string;
  pronunciationReplacements: Record<string, string>;
}): { text: string; evidence: VoiceoverPreparation; evidenceText: string } {
  const normalizedSource = normalizeLayout(input.sourceText);
  let prepared = normalizedSource;
  const applied: VoiceoverPreparation["replacements"] = [];
  const replacements = Object.entries(input.pronunciationReplacements).sort(
    ([left], [right]) => right.length - left.length || left.localeCompare(right),
  );
  for (const [source, replacement] of replacements) {
    const count = countLiteral(prepared, source);
    if (count === 0) {
      continue;
    }
    prepared = prepared.replaceAll(source, replacement);
    applied.push({ source, replacement, count });
  }
  const text = `${normalizeLayout(prepared)}\n`;
  const evidence = voiceoverPreparationSchema.parse({
    schemaVersion: 1,
    runId: input.runId,
    createdAt: nowIso(),
    source: { path: "production/voiceover.txt", sha256: sha256(input.sourceText) },
    output: { path: voiceoverPreparedTextPath, sha256: sha256(text), characterCount: text.length },
    replacements: applied,
  });
  return { text, evidence, evidenceText: `${JSON.stringify(evidence, null, 2)}\n` };
}

/**
 * Normalizes line endings, horizontal whitespace, and excessive blank lines in text.
 *
 * @param value - The text to normalize
 * @returns The normalized text without leading or trailing whitespace
 */
function normalizeLayout(value: string): string {
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Counts non-overlapping literal occurrences of a substring.
 *
 * @param value - The string to search
 * @param search - The literal substring to count
 * @returns The number of occurrences, or `0` when `search` is empty
 */
function countLiteral(value: string, search: string): number {
  if (!search) {
    return 0;
  }
  return value.split(search).length - 1;
}
