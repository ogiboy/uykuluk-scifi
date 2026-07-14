import { SafeExitError } from "../../../core/errors.js";
import { sha256 } from "../../../utils/hash.js";
import {
  normalizeVoiceoverSourceText,
  parseVoiceoverPreparationV2,
  type VoiceoverPreparationV2,
} from "../voiceoverPreparation.js";

export function validateSubtitlePreparation(input: {
  runId: string;
  sourceText: string;
  preparedText: string;
  preparation: VoiceoverPreparationV2;
}): string {
  const preparation = parseVoiceoverPreparationV2(input.preparation);
  const normalizedSource = normalizeVoiceoverSourceText(input.sourceText);
  if (
    preparation.runId !== input.runId ||
    preparation.source.sha256 !== sha256(input.sourceText) ||
    preparation.source.normalizedSha256 !== sha256(normalizedSource) ||
    preparation.source.normalizedCharacterCount !== normalizedSource.length ||
    preparation.output.sha256 !== sha256(input.preparedText) ||
    preparation.output.characterCount !== input.preparedText.length ||
    reconstructPreparedText(normalizedSource, preparation) !== input.preparedText
  ) {
    throw new SafeExitError("Voice subtitle preparation evidence does not match its source text.");
  }
  return normalizedSource;
}

function reconstructPreparedText(source: string, preparation: VoiceoverPreparationV2): string {
  let sourceCursor = 0;
  let prepared = "";
  for (const occurrence of preparation.replacementOccurrences) {
    if (
      source.slice(occurrence.sourceSpan.start, occurrence.sourceSpan.end) !== occurrence.source ||
      occurrence.sourceSpan.start < sourceCursor ||
      occurrence.preparedSpan.start !== prepared.length + occurrence.sourceSpan.start - sourceCursor
    ) {
      throw new SafeExitError("Voice pronunciation occurrence spans are inconsistent.");
    }
    prepared += source.slice(sourceCursor, occurrence.sourceSpan.start);
    if (occurrence.preparedSpan.start !== prepared.length) {
      throw new SafeExitError("Voice pronunciation prepared spans are inconsistent.");
    }
    prepared += occurrence.replacement;
    if (occurrence.preparedSpan.end !== prepared.length) {
      throw new SafeExitError("Voice pronunciation prepared spans are inconsistent.");
    }
    sourceCursor = occurrence.sourceSpan.end;
  }
  return prepared + source.slice(sourceCursor);
}
