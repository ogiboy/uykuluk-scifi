import { sha256 } from "../utils/hash";

export type PromptKey = "ideas" | "script" | "production-package";

export type PromptProvenance = {
  key: PromptKey;
  hash: string;
  artifact: string;
  source?: string;
};

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
