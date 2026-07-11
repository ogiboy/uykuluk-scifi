import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ProducerConfig } from "../config/schema.js";
import { validateArtifactRelativePath } from "../core/artifactPaths.js";
import { pathExists } from "../utils/fs.js";
import type { DoctorCheck } from "./doctor.js";

/**
 * Checks configured local prompt overrides before generation stages use them.
 *
 * @param config - Parsed producer config, when available.
 * @returns A doctor check covering prompt override paths and file content.
 */
export async function promptOverridesCheck(
  config: ProducerConfig | undefined,
): Promise<DoctorCheck> {
  if (!config) {
    return {
      name: "prompt overrides",
      status: "block",
      message: "Prompt override diagnostics require valid project config.",
      nextAction: "Fix producer.config.json, then rerun pnpm producer doctor.",
    };
  }
  const configured = promptOverrideEntries(config);
  if (configured.length === 0) {
    return {
      name: "prompt overrides",
      status: "pass",
      message: "No local prompt overrides configured.",
    };
  }
  return promptOverrideResult(await promptOverrideFindings(configured));
}

async function promptOverrideFindings(
  configured: Array<{ label: string; path: string }>,
): Promise<{ active: string[]; problems: string[] }> {
  const problems: string[] = [];
  const active: string[] = [];
  for (const override of configured) {
    try {
      const relativePath = validPromptOverridePath(override.path);
      const absolutePath = path.join(process.cwd(), relativePath);
      if (!(await pathExists(absolutePath))) {
        problems.push(`${override.label}: ${relativePath} is missing.`);
        continue;
      }
      const template = (await readFile(absolutePath, "utf8")).trim();
      if (!template) {
        problems.push(`${override.label}: ${relativePath} is empty.`);
        continue;
      }
      active.push(`${override.label}: ${relativePath}`);
    } catch (error) {
      problems.push(`${override.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { active, problems };
}

function promptOverrideResult({
  active,
  problems,
}: {
  active: string[];
  problems: string[];
}): DoctorCheck {
  return {
    name: "prompt overrides",
    status: problems.length === 0 ? "pass" : "block",
    message:
      problems.length === 0
        ? `Local prompt overrides ready: ${active.join(", ")}.`
        : problems.join(" "),
    nextAction:
      problems.length === 0
        ? undefined
        : "Move prompt override Markdown under prompts/local/, keep files non-empty, or remove prompts.overrides entries.",
  };
}

function promptOverrideEntries(config: ProducerConfig): Array<{ label: string; path: string }> {
  return [
    { label: "ideas", path: config.prompts.overrides.ideas },
    { label: "script", path: config.prompts.overrides.script },
    { label: "production package", path: config.prompts.overrides.productionPackage },
  ].filter((entry): entry is { label: string; path: string } => Boolean(entry.path));
}

function validPromptOverridePath(configured: string): string {
  const relativePath = validateArtifactRelativePath(configured);
  if (!relativePath.startsWith("prompts/local/") || !relativePath.endsWith(".md")) {
    throw new Error("override must be a Markdown file under prompts/local/.");
  }
  return relativePath;
}
