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

const halfOpenSpanSchema = z
  .strictObject({ start: z.int().nonnegative(), end: z.int().positive() })
  .refine((span) => span.end > span.start, { message: "Span end must be greater than start." });

const replacementOccurrenceSchema = z.strictObject({
  source: z.string().min(1),
  replacement: z.string().min(1),
  sourceSpan: halfOpenSpanSchema,
  preparedSpan: halfOpenSpanSchema,
});

export const voiceoverPreparationV1Schema = z.strictObject({
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

export const voiceoverPreparationV2Schema = z.strictObject({
  schemaVersion: z.literal(2),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  source: z.strictObject({
    path: z.literal("production/voiceover.txt"),
    sha256: digestSchema,
    normalizedSha256: digestSchema,
    normalizedCharacterCount: z.int().positive(),
    offsetUnit: z.literal("utf16-code-unit"),
  }),
  output: z.strictObject({
    path: z.literal(voiceoverPreparedTextPath),
    sha256: digestSchema,
    characterCount: z.int().positive(),
  }),
  replacements: z.array(appliedReplacementSchema),
  replacementOccurrences: z.array(replacementOccurrenceSchema),
});

export type VoiceoverPreparationV2 = z.infer<typeof voiceoverPreparationV2Schema>;

function validateVoiceoverPreparationV2(
  evidence: VoiceoverPreparationV2,
  context: z.RefinementCtx,
): void {
  let previousSourceEnd = 0;
  let previousPreparedEnd = 0;
  for (const [index, occurrence] of evidence.replacementOccurrences.entries()) {
    if (
      occurrence.sourceSpan.start < previousSourceEnd ||
      occurrence.preparedSpan.start < previousPreparedEnd
    ) {
      context.addIssue({
        code: "custom",
        path: ["replacementOccurrences", index],
        message: "Replacement occurrences must be ordered and non-overlapping.",
      });
    }
    if (
      occurrence.sourceSpan.end - occurrence.sourceSpan.start !== occurrence.source.length ||
      occurrence.preparedSpan.end - occurrence.preparedSpan.start !== occurrence.replacement.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["replacementOccurrences", index],
        message: "Replacement occurrence spans must match their UTF-16 text lengths.",
      });
    }
    previousSourceEnd = occurrence.sourceSpan.end;
    previousPreparedEnd = occurrence.preparedSpan.end;
  }
  for (const [index, replacement] of evidence.replacements.entries()) {
    const occurrenceCount = evidence.replacementOccurrences.filter(
      (item) => item.source === replacement.source && item.replacement === replacement.replacement,
    ).length;
    if (occurrenceCount !== replacement.count) {
      context.addIssue({
        code: "custom",
        path: ["replacements", index, "count"],
        message: "Replacement summary count must match occurrence evidence.",
      });
    }
  }
}

const validatedVoiceoverPreparationV2Schema = voiceoverPreparationV2Schema.superRefine(
  validateVoiceoverPreparationV2,
);

export const persistedVoiceoverPreparationSchema = z
  .discriminatedUnion("schemaVersion", [voiceoverPreparationV1Schema, voiceoverPreparationV2Schema])
  .superRefine((evidence, context) => {
    if (evidence.schemaVersion === 2) {
      validateVoiceoverPreparationV2(evidence, context);
    }
  });

/** Compatibility alias used by existing persisted-evidence readers. */
export const voiceoverPreparationSchema = persistedVoiceoverPreparationSchema;

export type PersistedVoiceoverPreparation = z.infer<typeof persistedVoiceoverPreparationSchema>;

/** Parses either legacy schema v1 or current schema v2 preparation evidence. */
export function parsePersistedVoiceoverPreparation(value: unknown): PersistedVoiceoverPreparation {
  return persistedVoiceoverPreparationSchema.parse(value);
}

/** Parses current schema v2 evidence with its cross-field occurrence invariants. */
export function parseVoiceoverPreparationV2(value: unknown): VoiceoverPreparationV2 {
  return validatedVoiceoverPreparationV2Schema.parse(value);
}

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
}): { text: string; evidence: VoiceoverPreparationV2; evidenceText: string } {
  const normalizedSource = normalizeVoiceoverSourceText(input.sourceText);
  const replacements = Object.entries(input.pronunciationReplacements).sort(
    ([left], [right]) => right.length - left.length || compareCodeUnits(left, right),
  );
  const replacementResult = applyReplacementsOnce(normalizedSource, replacements);
  const text = replacementResult.text;
  const applied = replacements.flatMap(([source, replacement]) => {
    const count = replacementResult.occurrences.filter((item) => item.source === source).length;
    return count > 0 ? [{ source, replacement, count }] : [];
  });
  const evidence = parseVoiceoverPreparationV2({
    schemaVersion: 2,
    runId: input.runId,
    createdAt: nowIso(),
    source: {
      path: "production/voiceover.txt",
      sha256: sha256(input.sourceText),
      normalizedSha256: sha256(normalizedSource),
      normalizedCharacterCount: normalizedSource.length,
      offsetUnit: "utf16-code-unit",
    },
    output: { path: voiceoverPreparedTextPath, sha256: sha256(text), characterCount: text.length },
    replacements: applied,
    replacementOccurrences: replacementResult.occurrences,
  });
  return { text, evidence, evidenceText: `${JSON.stringify(evidence, null, 2)}\n` };
}

/** Normalizes the original Turkish narration and preserves its canonical trailing newline. */
export function normalizeVoiceoverSourceText(value: string): string {
  return `${normalizeLayout(value)}\n`;
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

/** Applies configured replacements once against normalized source text. */
function applyReplacementsOnce(
  sourceText: string,
  replacements: Array<[string, string]>,
): { text: string; occurrences: VoiceoverPreparationV2["replacementOccurrences"] } {
  let sourceCursor = 0;
  let prepared = "";
  const occurrences: VoiceoverPreparationV2["replacementOccurrences"] = [];
  while (sourceCursor < sourceText.length) {
    const match = replacements.find(
      ([source]) => source.length > 0 && sourceText.startsWith(source, sourceCursor),
    );
    if (!match) {
      prepared += sourceText[sourceCursor];
      sourceCursor += 1;
      continue;
    }
    const [source, replacement] = match;
    const preparedStart = prepared.length;
    prepared += replacement;
    occurrences.push({
      source,
      replacement,
      sourceSpan: { start: sourceCursor, end: sourceCursor + source.length },
      preparedSpan: { start: preparedStart, end: prepared.length },
    });
    sourceCursor += source.length;
  }
  return { text: prepared, occurrences };
}

function compareCodeUnits(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
