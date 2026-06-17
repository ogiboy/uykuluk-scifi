export type ScriptReviewWarning = {
  code: string;
  severity: "info" | "warning" | "blocker";
  message: string;
};

export function reviewScriptContent(script: string): ScriptReviewWarning[] {
  const warnings: ScriptReviewWarning[] = [];
  const words = script.trim().split(/\s+/).filter(Boolean);
  if (words.length < 250) {
    warnings.push({
      code: "too_short",
      severity: "warning",
      message: `Script is short for a full video (${words.length} words).`,
    });
  }
  if (words.length > 1800) {
    warnings.push({
      code: "too_long",
      severity: "warning",
      message: `Script may be too long for the MVP target (${words.length} words).`,
    });
  }
  const certaintyMatches =
    script.match(/\b(kesin|kanıtlandı|kanitlandi|asla|mutlaka|tartışmasız|tartismasiz)\b/gi) ?? [];
  if (certaintyMatches.length > 3) {
    warnings.push({
      code: "misleading_certainty",
      severity: "warning",
      message:
        "Script uses repeated certainty language; scientific speculation should stay cautious.",
    });
  }
  const claimMatches =
    script.match(
      /\b(bilim|kanıt|kanit|araştırma|arastirma|gözlem|gozlem|veri|teori|hipotez)\b/gi,
    ) ?? [];
  if (claimMatches.length > 10) {
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
  if (
    !script
      .split("\n")
      .slice(0, 4)
      .join(" ")
      .match(/\?|vardir|vardır|hayal|sessiz|uzak|bazi|bazı/i)
  ) {
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
