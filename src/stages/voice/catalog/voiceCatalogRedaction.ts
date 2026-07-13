import { SafeExitError } from "../../../core/errors.js";
import type { VoiceCatalogProviderResult } from "./voiceCatalogContracts.js";
import type { CatalogVoice } from "./voiceCatalogProvider.js";

/** Blocks provider-controlled metadata that echoes known credentials or raw request evidence. */
export function assertVoiceCatalogRedacted(input: {
  apiKey: string;
  catalog: VoiceCatalogProviderResult;
  requestIds: string[];
  voices: CatalogVoice[];
}): void {
  const serialized = JSON.stringify(input.catalog);
  const sensitiveValues = new Set<string>([
    input.apiKey,
    ...input.requestIds,
    ...previewSensitiveValues(input.voices),
  ]);
  for (const value of sensitiveValues) {
    if (value.length >= 8 && serialized.includes(value)) {
      throw new SafeExitError(
        "ElevenLabs voice metadata echoed sensitive provider data and was rejected.",
      );
    }
  }
}

function previewSensitiveValues(voices: CatalogVoice[]): string[] {
  const values: string[] = [];
  for (const voice of voices) {
    collectPreviewValue(values, voice.previewUrl);
    for (const language of voice.verifiedLanguages ?? []) {
      collectPreviewValue(values, language.previewUrl);
    }
  }
  return values;
}

function collectPreviewValue(target: string[], value: string | undefined): void {
  if (!value) return;
  target.push(value);
  try {
    const url = new URL(value);
    for (const queryValue of url.searchParams.values()) {
      if (queryValue.length >= 8) target.push(queryValue);
    }
  } catch {
    // The full malformed provider value is still scanned above.
  }
}
