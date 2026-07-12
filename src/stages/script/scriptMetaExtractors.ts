/** Extracts bounded science-adjacent claims for operator fact-check review. */
export function extractClaims(script: string): string[] {
  return script
    .split(/[.!?]\s+/)
    .filter((sentence) =>
      /\b(Europa|Enceladus|okyanus|gelgit|bilim|kanıt|kanit|gözlem|gozlem)\b/i.test(sentence),
    )
    .slice(0, 8);
}

/** Extracts bounded visual beat candidates from a reviewed script. */
export function extractVisualBeats(script: string): string[] {
  return script
    .split("\n")
    .filter((line) =>
      /\b(goruntu|görüntü|kamera|buz|okyanus|isigi|ışığı|karanlik|karanlık)\b/i.test(line),
    )
    .slice(0, 8);
}
