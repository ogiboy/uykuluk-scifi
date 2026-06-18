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

export async function renderIdeasPrompt(): Promise<RenderedPrompt> {
  return renderTrackedPrompt("ideas", "IDEAS_JSON");
}

export async function renderScriptPrompt(ideaJson: string): Promise<RenderedPrompt> {
  return renderTrackedPrompt("script", "SCRIPT_MARKDOWN", ["## Approved Idea", ideaJson]);
}

export async function renderProductionPackagePrompt(script: string): Promise<RenderedPrompt> {
  return renderTrackedPrompt("production-package", "PRODUCTION_PACKAGE_JSON", [
    "## Approved Script",
    script.trim(),
  ]);
}

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
