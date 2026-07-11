import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config/config.js";
import { SafeExitError } from "../core/errors.js";
import { promptOverridePath } from "./catalog.js";
import { PROMPT_TEMPLATE_DEFINITIONS, type PromptKey } from "./definitions.js";

export type RenderedPrompt = { key: PromptKey; source: string; text: string };

/**
 * Renders the ideas prompt template.
 *
 * @param context - Optional compact runtime context to append after the planner template.
 * @returns A `RenderedPrompt` containing the ideas prompt.
 */
export async function renderIdeasPrompt(context: string[] = []): Promise<RenderedPrompt> {
  return renderDefaultPrompt("ideas", "IDEAS_JSON", context);
}

/**
 * Composes a script prompt with an approved idea.
 *
 * @param ideaJson - The approved idea as a JSON string
 * @returns A `RenderedPrompt` containing the script template with the idea integrated
 */
export async function renderScriptPrompt(ideaJson: string): Promise<RenderedPrompt> {
  return renderDefaultPrompt("script", "SCRIPT_MARKDOWN", ["## Approved Idea", ideaJson]);
}

/**
 * Renders a production package prompt template with the provided approved script.
 *
 * @param script - The approved script content to include in the prompt
 * @returns A `RenderedPrompt` containing the production package prompt with the script context
 */
export async function renderProductionPackagePrompt(script: string): Promise<RenderedPrompt> {
  return renderDefaultPrompt("production-package", "PRODUCTION_PACKAGE_JSON", [
    "## Approved Script",
    script.trim(),
  ]);
}

/**
 * Loads a runtime prompt default from disk and composes it with a contract marker and optional context blocks.
 *
 * @param key - The prompt type to load
 * @param contractMarker - A marker string to include at the start of the composed text
 * @param context - Optional content blocks to append after the template
 * @returns A rendered prompt containing the template key, source path, and composed text
 * @throws {SafeExitError} If the default prompt file cannot be read or is empty
 */
async function renderDefaultPrompt(
  key: PromptKey,
  contractMarker: string,
  context: string[] = [],
): Promise<RenderedPrompt> {
  const source = await readPromptTemplateSource(key);
  return {
    key,
    source: source.path,
    text: [contractMarker, source.template, ...context].join("\n\n"),
  };
}

async function readPromptTemplateSource(
  key: PromptKey,
): Promise<{ path: string; template: string }> {
  let template: string;
  const overridePath = promptOverridePath(key, (await loadConfig()).prompts.overrides);
  if (overridePath) {
    try {
      template = (await readFile(path.join(process.cwd(), overridePath), "utf8")).trim();
    } catch (error) {
      throw new SafeExitError(
        `Runtime prompt override unavailable: ${overridePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (!template) {
      throw new SafeExitError(`Runtime prompt override is empty: ${overridePath}`);
    }
    return { path: overridePath, template };
  }

  const source = PROMPT_TEMPLATE_DEFINITIONS[key];
  try {
    template = (await readFile(source.defaultUrl, "utf8")).trim();
  } catch (error) {
    throw new SafeExitError(
      `Runtime prompt default unavailable: ${source.defaultPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!template) {
    throw new SafeExitError(`Runtime prompt default is empty: ${source.defaultPath}`);
  }
  return { path: source.defaultPath, template };
}
