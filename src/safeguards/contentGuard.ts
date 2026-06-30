import { malformedProductionLabelDetails } from "./productionLabelDetails.js";
import { repeatedSentenceLoopDetails } from "./scriptRepetitionDetails.js";

export type ScriptReviewWarning = {
  code: string;
  details?: Record<string, string>;
  severity: "info" | "warning" | "blocker";
  message: string;
};

/**
 * Validates a script against quality, safety, and style guidelines.
 *
 * Checks for word count, clickbait framing, excessive certainty language, scientific claims,
 * disaster framing responsibility, missing outro, weak opening hooks, trademark references,
 * and UykulukSciFi style compliance.
 *
 * @param script - The script text to review
 * @returns An array of warnings describing detected issues
 */
export function reviewScriptContent(script: string): ScriptReviewWarning[] {
  const warnings: ScriptReviewWarning[] = [];
  const words = script.trim().split(/\s+/).filter(Boolean);
  const trimmed = script.trim();
  const title = script
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  appendBlockingScriptWarnings(warnings, trimmed);
  appendLengthWarnings(warnings, words.length);
  appendTitleWarnings(warnings, title);
  appendScienceWarnings(warnings, script);
  appendStyleWarnings(warnings, script);
  return warnings;
}

function appendBlockingScriptWarnings(warnings: ScriptReviewWarning[], script: string): void {
  if (looksTruncated(script)) {
    warnings.push({
      code: "incomplete_script",
      severity: "blocker",
      message: "Script appears incomplete or truncated; regenerate before review approval.",
    });
  }
  if (containsEnglishProductionText(script)) {
    warnings.push({
      code: "non_turkish_production_text",
      severity: "blocker",
      message: "Script contains English production labels or directions; regenerate in Turkish.",
    });
  }
  if (containsModelMetaCommentary(script)) {
    warnings.push({
      code: "model_meta_commentary",
      severity: "blocker",
      message:
        "Script contains model self-evaluation or prompt-compliance commentary; regenerate before review.",
    });
  }
  if (containsLiteralModelEscapes(script)) {
    warnings.push({
      code: "literal_model_escape_text",
      severity: "blocker",
      message:
        "Script contains literal escaped control text from the model response; regenerate before review.",
    });
  }
  if (containsProviderArtifactMetadata(script)) {
    warnings.push({
      code: "provider_artifact_metadata",
      severity: "blocker",
      message:
        "Script contains provider artifact metadata instead of clean narration; regenerate before review.",
    });
  }
  if (containsRepeatedWordStutter(script)) {
    warnings.push({
      code: "repeated_word_stutter",
      severity: "blocker",
      message: "Script contains a repeated word stutter; regenerate before review.",
    });
  }
  const malformedLabelDetails = malformedProductionLabelDetails(script);
  if (malformedLabelDetails) {
    warnings.push({
      code: "malformed_production_label",
      details: malformedLabelDetails,
      severity: "blocker",
      message: "Script contains malformed Turkish production labels; regenerate before review.",
    });
  }
  const repeatedLoopDetails = repeatedSentenceLoopDetails(script);
  if (repeatedLoopDetails) {
    warnings.push({
      code: "repeated_sentence_loop",
      details: repeatedLoopDetails,
      severity: "blocker",
      message: "Script repeats the same sentence loop; regenerate before review.",
    });
  }
}

function appendLengthWarnings(warnings: ScriptReviewWarning[], wordCount: number): void {
  if (wordCount < 1200) {
    warnings.push({
      code: "too_short",
      severity: "warning",
      message: `Script is short for the 20-minute target (${wordCount} words).`,
    });
  }
  if (wordCount > 1800) {
    warnings.push({
      code: "too_long",
      severity: "warning",
      message: `Script may be too long for the MVP target (${wordCount} words).`,
    });
  }
}

function appendTitleWarnings(warnings: ScriptReviewWarning[], title: string | undefined): void {
  if (!title || !hasClickbaitTitle(title)) {
    return;
  }
  warnings.push({
    code: "clickbait_title",
    severity: "warning",
    message: "Title uses excessive clickbait framing; prefer specific, credible curiosity.",
  });
}

function hasClickbaitTitle(title: string): boolean {
  return (
    /\b(şok|sok|inanılmaz|inanilmaz|kimse bilmiyor|aklınızı alacak|aklinizi alacak)\b/i.test(
      title,
    ) || /!{2,}/.test(title)
  );
}

function appendScienceWarnings(warnings: ScriptReviewWarning[], script: string): void {
  const certaintyMatchCount = countRegexMatches(
    script,
    /\b(kesin|kanıtlandı|kanitlandi|asla|mutlaka|tartışmasız|tartismasiz)\b/gi,
  );
  if (certaintyMatchCount > 3) {
    warnings.push({
      code: "misleading_certainty",
      severity: "warning",
      message:
        "Script uses repeated certainty language; scientific speculation should stay cautious.",
    });
  }
  const scienceClaimCount = countRegexMatches(
    script,
    /\b(bilim|kanıt|kanit|araştırma|arastirma|gözlem|gozlem|veri|teori|hipotez)\b/gi,
  );
  if (scienceClaimCount > 10) {
    warnings.push({
      code: "claims_require_fact_check",
      severity: "warning",
      message:
        "Script contains many science-adjacent claims; collect fact-check notes before production.",
    });
  }
  if (
    /\b(felaket|yok oluş|yok olus|katliam|savaş|savas)\b/i.test(script) &&
    !/\b(sorumlu|ihtiyat|dikkatli|bağlam|baglam)\b/i.test(script)
  ) {
    warnings.push({
      code: "responsible_framing_missing",
      severity: "warning",
      message: "Disaster or violent framing needs responsible wording.",
    });
  }
}

function appendStyleWarnings(warnings: ScriptReviewWarning[], script: string): void {
  if (!/\b(abone|yorum|sonraki|yeniden buluşalım|yeniden bulusalim|UykulukSciFi)\b/i.test(script)) {
    warnings.push({
      code: "missing_outro",
      severity: "warning",
      message: "Script may be missing an outro or call to action.",
    });
  }
  const introHookPattern = /\?|vardir|vardır|hayal|sessiz|uzak|bazi|bazı/i;
  if (introHookPattern.exec(introNarrationWindow(script)) === null) {
    warnings.push({
      code: "missing_intro_hook",
      severity: "warning",
      message: "Opening hook is weak or missing.",
    });
  }
  if (/\b(Star Wars|Star Trek|Dune|Alien|Blade Runner)\b/gi.test(script)) {
    warnings.push({
      code: "copyright_trademark_heavy",
      severity: "warning",
      message: "Script references protected fictional properties; avoid trademark-heavy framing.",
    });
  }
  if (!/\b(sakin|sinematik|bilimkurgu|bilimsel|ihtiyat|olasılık|olasilik)\b/i.test(script)) {
    warnings.push({
      code: "style_mismatch",
      severity: "warning",
      message: "Script may not match the calm, cinematic, careful UykulukSciFi style.",
    });
  }
}

function countRegexMatches(text: string, pattern: RegExp): number {
  let count = 0;
  while (pattern.exec(text) !== null) {
    count += 1;
  }
  return count;
}

function introNarrationWindow(script: string): string {
  return script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .slice(0, 4)
    .join(" ");
}

function looksTruncated(script: string): boolean {
  const nonEmptyLines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = nonEmptyLines.at(-1);
  if (!lastLine) {
    return true;
  }
  return !/[.!?…)\]”"'](?:\*\*)?$/.test(lastLine);
}

function containsEnglishProductionText(script: string): boolean {
  return /\b(?:Narration|Narrator|Cut to|screen fades|camera lingers|ambient soundscape|research laboratory|close-up)\b/i.test(
    script,
  );
}

function containsModelMetaCommentary(script: string): boolean {
  return /\b(?:All constraints met|All requirements met|This is the final JSON object|JSON object is complete|There is no further output|All accents correct|No forbidden label variants|No repeated sentence loops|No recycled subject-verb-object patterns|No hard limit exceeded|No errors|Preserved key details|Cinematic tone|Responsible speculation|Perfect response|Excellent work|masterful response|flawless execution|I am (?:extremely pleased|incredibly impressed)|This is exactly what (?:I|was) (?:requested|looking for)|\d{2,4}\s+words\.\s+\d{2,5}\s+characters)\b/i.test(
    script,
  );
}

function containsLiteralModelEscapes(script: string): boolean {
  return /(?:\\[nrt]|\\u[0-9a-f]{4})/iu.test(script);
}

function containsProviderArtifactMetadata(script: string): boolean {
  return /\b(?:id|section_id|targetDuration|estimatedDifficulty|riskLevel)=/u.test(script);
}

function containsRepeatedWordStutter(script: string): boolean {
  const words = script.match(/[\p{L}\p{M}]{2,}/gu) ?? [];
  let previous = "";
  let repeatCount = 0;
  for (const word of words) {
    const normalized = word.toLocaleLowerCase("tr");
    if (normalized === previous) {
      repeatCount += 1;
      if (repeatCount >= 8) {
        return true;
      }
      continue;
    }
    previous = normalized;
    repeatCount = 1;
  }
  return false;
}
