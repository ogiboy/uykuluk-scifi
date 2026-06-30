export function containsLiteralModelEscapes(script: string): boolean {
  return /(?:\\[nrt]|\\u[0-9a-f]{4})/iu.test(script);
}

export function containsProviderArtifactMetadata(script: string): boolean {
  return /\b(?:id|section_id|targetDuration|estimatedDifficulty|riskLevel)=/u.test(script);
}

export function containsRepeatedWordStutter(script: string): boolean {
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
