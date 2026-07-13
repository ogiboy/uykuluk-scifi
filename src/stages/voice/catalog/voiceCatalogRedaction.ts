import { SafeExitError } from "../../../core/errors.js";
import type { VoiceCatalogProviderResult } from "./voiceCatalogContracts.js";
import type { CatalogVoice } from "./voiceCatalogProvider.js";

/**
 * Rejects provider voice metadata that echoes sensitive request data.
 *
 * @param input - The catalog, API key, request IDs, and voice data used to identify sensitive values.
 * @throws `SafeExitError` if the catalog contains a sensitive value at least eight characters long.
 */
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

/**
 * Collects preview URL values and sufficiently long query parameter values from voices and their verified languages.
 *
 * @param voices - Voices whose preview metadata is inspected
 * @returns Sensitive values derived from the preview URLs
 */
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

/**
 * Adds a preview value and sufficiently long query parameter values from it to a collection.
 *
 * @param target - The collection to which sensitive values are added
 * @param value - The preview URL or provider value to inspect
 */
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
