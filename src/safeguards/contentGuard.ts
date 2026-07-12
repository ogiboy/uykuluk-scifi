import { countSpokenNarrationWords } from "../utils/scriptProductionText.js";
import {
  containsLiteralModelEscapes,
  containsProviderArtifactMetadata,
  containsRepeatedWordStutter,
} from "./modelArtifactText.js";
import { containsModelMetaCommentary } from "./modelMetaCommentary.js";
import {
  ambiguousVisualDirectionDetails,
  malformedProductionLabelDetails,
} from "./productionLabelDetails.js";
import {
  appendScienceWarnings,
  appendStyleWarnings,
  type ScriptReviewWarning,
} from "./scriptEditorialWarnings.js";
import {
  scriptLongFormUpperWarning,
  scriptLongFormWordFloor,
  scriptTargetDurationLabel,
} from "./scriptLengthContract.js";
import { repeatedSentenceLoopDetails } from "./scriptRepetitionDetails.js";

export type { ScriptReviewWarning } from "./scriptEditorialWarnings.js";

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
  appendLengthWarnings(warnings, script, words.length);
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
  const visualDirectionDetails = ambiguousVisualDirectionDetails(script);
  if (visualDirectionDetails) {
    warnings.push({
      code: "ambiguous_visual_direction",
      details: visualDirectionDetails,
      severity: "blocker",
      message:
        "A visual direction contains multiple sentences and can hide narration from TTS; label each following sentence explicitly.",
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
  if (containsUnsupportedExtraterrestrialCertainty(script)) {
    warnings.push({
      code: "unsupported_extraterrestrial_certainty",
      severity: "blocker",
      message:
        "Script presents extraterrestrial life as demonstrated fact; reframe it as speculation or remove the claim.",
    });
  }
}

function appendLengthWarnings(
  warnings: ScriptReviewWarning[],
  script: string,
  totalWordCount: number,
): void {
  const narrationWordCount = countSpokenNarrationWords(script);
  if (narrationWordCount < scriptLongFormWordFloor) {
    warnings.push({
      code: "too_short",
      severity: "warning",
      message: `Spoken narration is short for the ${scriptTargetDurationLabel} (${narrationWordCount}/${scriptLongFormWordFloor} words).`,
    });
  }
  if (totalWordCount > scriptLongFormUpperWarning) {
    warnings.push({
      code: "too_long",
      severity: "warning",
      message: `Script may be too long for the ${scriptTargetDurationLabel} (${totalWordCount}/${scriptLongFormUpperWarning} words).`,
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

function containsUnsupportedExtraterrestrialCertainty(script: string): boolean {
  return /\binsanlığın\s+evrende\s+yalnız\s+olmadığını[^.!?]{0,160}\bgöster\p{L}*/iu.test(script);
}
