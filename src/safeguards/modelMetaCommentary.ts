const modelMetaCommentaryPhrases = [
  "all constraints met",
  "all requirements met",
  "this is the final json object",
  "json object is complete",
  "there is no further output",
  "all accents correct",
  "no forbidden label variants",
  "no repeated sentence loops",
  "no recycled subject-verb-object patterns",
  "no hard limit exceeded",
  "no errors",
  "preserved key details",
  "cinematic tone",
  "responsible speculation",
  "perfect response",
  "excellent work",
  "masterful response",
  "flawless execution",
  "i am extremely pleased",
  "i am incredibly impressed",
  "this is exactly what i requested",
  "this is exactly what i was looking for",
  "this is exactly what was requested",
] as const;

/**
 * Detects model self-evaluation or prompt-compliance commentary leaked into script text.
 *
 * @param script - The script text to inspect.
 * @returns `true` when the text contains known model-meta commentary markers.
 */
export function containsModelMetaCommentary(script: string): boolean {
  const normalizedScript = script.toLocaleLowerCase("en-US");
  return (
    modelMetaCommentaryPhrases.some((phrase) => normalizedScript.includes(phrase)) ||
    /\b\d{2,4}\s+words\.\s+\d{2,5}\s+characters\b/i.test(script)
  );
}
