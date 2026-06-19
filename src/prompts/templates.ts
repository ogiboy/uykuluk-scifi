import { readFile } from "node:fs/promises";
import { SafeExitError } from "../core/errors";
import { PromptKey } from "./provenance";

export type RenderedPrompt = {
  key: PromptKey;
  source: string;
  text: string;
};

const promptSources = {
  ideas: {
    path: ".ai/prompts/planner-task.md",
    url: new URL("../../.ai/prompts/planner-task.md", import.meta.url),
  },
  script: {
    path: ".ai/prompts/scriptwriter-task.md",
    url: new URL("../../.ai/prompts/scriptwriter-task.md", import.meta.url),
  },
  "production-package": {
    path: ".ai/prompts/production-package-task.md",
    url: new URL("../../.ai/prompts/production-package-task.md", import.meta.url),
  },
} as const satisfies Record<PromptKey, { path: string; url: URL }>;

/**
 * Renders the ideas prompt template.
 *
 * @returns A `RenderedPrompt` containing the ideas prompt.
 */
export async function renderIdeasPrompt(): Promise<RenderedPrompt> {
  return renderTrackedPrompt("ideas", "IDEAS_JSON");
}

/**
 * Composes a script prompt with an approved idea.
 *
 * @param ideaJson - The approved idea as a JSON string
 * @returns A `RenderedPrompt` containing the script template with the idea integrated
 */
export async function renderScriptPrompt(ideaJson: string): Promise<RenderedPrompt> {
  return renderTrackedPrompt("script", "SCRIPT_MARKDOWN", ["## Approved Idea", ideaJson]);
}

/**
 * Renders a production package prompt template with the provided approved script.
 *
 * @param script - The approved script content to include in the prompt
 * @returns A `RenderedPrompt` containing the production package prompt with the script context
 */
export async function renderProductionPackagePrompt(script: string): Promise<RenderedPrompt> {
  return renderTrackedPrompt("production-package", "PRODUCTION_PACKAGE_JSON", [
    "## Approved Script",
    script.trim(),
  ]);
}

/**
 * Loads a prompt template from disk and composes it with a contract marker and optional context blocks.
 *
 * @param key - The prompt type to load
 * @param contractMarker - A marker string to include at the start of the composed text
 * @param context - Optional content blocks to append after the template
 * @returns A rendered prompt containing the template key, source path, and composed text
 * @throws {SafeExitError} If the template file cannot be read or is empty
 */
async function renderTrackedPrompt(
  key: PromptKey,
  contractMarker: string,
  context: string[] = [],
): Promise<RenderedPrompt> {
  const source = promptSources[key];
  let template: string;
  try {
    template = (await readFile(source.url, "utf8")).trim();
  } catch (error) {
    throw new SafeExitError(
      `Tracked prompt template unavailable: ${source.path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!template) {
    throw new SafeExitError(`Tracked prompt template is empty: ${source.path}`);
  }
  return {
    key,
    source: source.path,
    text: [contractMarker, template, ...context].join("\n\n"),
  };
}
