export type ScriptReviewWarning = {
  code: string;
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
  if (looksTruncated(trimmed)) {
    warnings.push({
      code: "incomplete_script",
      severity: "blocker",
      message: "Script appears incomplete or truncated; regenerate before review approval.",
    });
  }
  if (containsEnglishProductionText(trimmed)) {
    warnings.push({
      code: "non_turkish_production_text",
      severity: "blocker",
      message: "Script contains English production labels or directions; regenerate in Turkish.",
    });
  }
  if (words.length < 1200) {
    warnings.push({
      code: "too_short",
      severity: "warning",
      message: `Script is short for the 20-minute target (${words.length} words).`,
    });
  }
  if (words.length > 1800) {
    warnings.push({
      code: "too_long",
      severity: "warning",
      message: `Script may be too long for the MVP target (${words.length} words).`,
    });
  }
  if (
    title &&
    (/\b(şok|sok|inanılmaz|inanilmaz|kimse bilmiyor|aklınızı alacak|aklinizi alacak)\b/i.test(
      title,
    ) ||
      /!{2,}/.test(title))
  ) {
    warnings.push({
      code: "clickbait_title",
      severity: "warning",
      message: "Title uses excessive clickbait framing; prefer specific, credible curiosity.",
    });
  }
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
  return warnings;
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
