import { namedRoleContinuityDetails } from "./scriptContinuityDetails.js";

export type ScriptReviewWarning = {
  code: string;
  details?: Record<string, string>;
  severity: "info" | "warning" | "blocker";
  message: string;
};

export function appendScienceWarnings(warnings: ScriptReviewWarning[], script: string): void {
  const quantitativeClaimCount = countRegexMatches(
    script,
    /\b\d+(?:[.,]\d+)?\s*(?:saniye|dakika|saat|gün|yıl|ışık\s+yıl|kilometre|metre|kelvin|derece)\p{L}*/giu,
  );
  if (quantitativeClaimCount > 0) {
    warnings.push({
      code: "quantitative_claims_require_fact_check",
      details: { claimCount: String(quantitativeClaimCount) },
      severity: "warning",
      message: "Script contains quantitative science claims; verify each value before production.",
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
}

export function appendStyleWarnings(warnings: ScriptReviewWarning[], script: string): void {
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
  const continuityDetails = namedRoleContinuityDetails(script);
  if (continuityDetails) {
    warnings.push({
      code: "inconsistent_named_role",
      details: continuityDetails,
      severity: "warning",
      message:
        "Script uses multiple names for the same specialist role; verify character continuity.",
    });
  }
  if (countRegexMatches(script, /\bUykulukSciFi\b/gu) > 2) {
    warnings.push({
      code: "repetitive_outro_call",
      severity: "warning",
      message: "Script repeats the channel call to action; keep one concise final outro.",
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
