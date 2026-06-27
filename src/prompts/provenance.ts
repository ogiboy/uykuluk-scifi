import { sha256 } from "../utils/hash.js";
import type { PromptKey } from "./definitions.js";

export type { PromptKey } from "./definitions.js";

export type PromptProvenance = {
  key: PromptKey;
  hash: string;
  artifact: string;
  source?: string;
};

/**
 * Creates a provenance metadata object for a prompt.
 *
 * @param prompt - The prompt text used to compute the SHA-256 hash
 * @returns A provenance object containing the key, computed hash, artifact, and source
 */
export function createPromptProvenance(
  key: PromptKey,
  prompt: string,
  artifact: string,
  source: string,
): PromptProvenance {
  return {
    key,
    hash: sha256(prompt),
    artifact,
    source,
  };
}
