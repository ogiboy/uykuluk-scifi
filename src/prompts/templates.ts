import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config/config.js";
import { validateArtifactRelativePath } from "../core/artifactPaths.js";
import { SafeExitError } from "../core/errors.js";
import { PromptKey } from "./provenance.js";

export type RenderedPrompt = {
  key: PromptKey;
  source: string;
  text: string;
};

const promptSources = {
  ideas: {
    path: "prompts/defaults/planner-task.md",
    url: new URL("../../prompts/defaults/planner-task.md", import.meta.url),
  },
  script: {
    path: "prompts/defaults/scriptwriter-task.md",
    url: new URL("../../prompts/defaults/scriptwriter-task.md", import.meta.url),
  },
  "production-package": {
    path: "prompts/defaults/production-package-task.md",
    url: new URL("../../prompts/defaults/production-package-task.md", import.meta.url),
  },
} as const satisfies Record<PromptKey, { path: string; url: URL }>;

const promptOverrideConfigKeys = {
  ideas: "ideas",
  script: "script",
  "production-package": "productionPackage",
} as const satisfies Record<PromptKey, "ideas" | "script" | "productionPackage">;

/**
 * Renders the ideas prompt template.
 *
 * @returns A `RenderedPrompt` containing the ideas prompt.
 */
export async function renderIdeasPrompt(): Promise<RenderedPrompt> {
  return renderDefaultPrompt("ideas", "IDEAS_JSON");
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

async function readPromptTemplateSource(key: PromptKey): Promise<{
  path: string;
  template: string;
}> {
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

  const source = promptSources[key];
  try {
    template = (await readFile(source.url, "utf8")).trim();
  } catch (error) {
    throw new SafeExitError(
      `Runtime prompt default unavailable: ${source.path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!template) {
    throw new SafeExitError(`Runtime prompt default is empty: ${source.path}`);
  }
  return { path: source.path, template };
}

function promptOverridePath(
  key: PromptKey,
  overrides: Partial<Record<"ideas" | "script" | "productionPackage", string>>,
): string | undefined {
  const configured = overrides[promptOverrideConfigKeys[key]];
  if (!configured) {
    return undefined;
  }
  const relativePath = validateArtifactRelativePath(configured);
  if (!relativePath.startsWith("prompts/local/") || !relativePath.endsWith(".md")) {
    throw new SafeExitError(
      "Runtime prompt overrides must be Markdown files under prompts/local/.",
    );
  }
  return relativePath;
}
