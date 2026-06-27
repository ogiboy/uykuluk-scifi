import { SafeExitError } from "../core/errors.js";
import {
  PROMPT_TEMPLATE_DEFINITIONS,
  type PromptKey,
  type PromptOverrideConfigKey,
} from "./definitions.js";
import { isValidPromptOverridePath } from "./pathRules.js";

/**
 * Resolves a configured local prompt override path for a prompt key.
 *
 * @param key - Prompt key whose override should be resolved
 * @param overrides - Prompt override config from `producer.config.json`
 * @returns Safe prompt override path, or `undefined` when no override is configured
 * @throws {SafeExitError} If the configured path is not an ignored local Markdown prompt
 */
export function promptOverridePath(
  key: PromptKey,
  overrides: Partial<Record<PromptOverrideConfigKey, string>>,
): string | undefined {
  const configured = overrides[PROMPT_TEMPLATE_DEFINITIONS[key].overrideConfigKey];
  if (!configured) {
    return undefined;
  }
  return validatePromptOverridePath(configured);
}

/**
 * Validates a configured prompt override path.
 *
 * @param configured - Configured path from `producer.config.json`
 * @returns Canonical artifact-relative prompt override path
 * @throws {SafeExitError} If the path is outside `prompts/local/*.md`
 */
export function validatePromptOverridePath(configured: string): string {
  if (!isValidPromptOverridePath(configured)) {
    throw new SafeExitError(
      "Runtime prompt overrides must be Markdown files under prompts/local/.",
    );
  }
  return configured;
}
