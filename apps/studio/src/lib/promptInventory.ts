import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { producerConfigSchema } from "../../../../src/config/schema";
import {
  PROMPT_KEYS,
  PROMPT_TEMPLATE_DEFINITIONS,
  type PromptKey,
  type PromptOverrideConfigKey,
} from "../../../../src/prompts/definitions";
import { isValidPromptOverridePath } from "../../../../src/prompts/pathRules";
import { sha256 } from "../../../../src/utils/hash";
import { formatProjectPath, resolveProducerConfigPath } from "./assetInventoryConfig";
import { projectRoot } from "./projectRoot";
import type { StudioPromptEntry, StudioPromptInventory } from "./promptInventoryTypes";

export type { StudioPromptEntry, StudioPromptInventory } from "./promptInventoryTypes";

type PromptConfigReadResult = {
  overrides: Partial<Record<PromptOverrideConfigKey, string>>;
  source: string;
  valid: boolean;
  warning: string | null;
};

/**
 * Builds a read-only inventory of runtime prompt defaults and configured local overrides.
 *
 * @returns Prompt inventory for Studio operator review
 */
export async function getStudioPromptInventory(): Promise<StudioPromptInventory> {
  const root = projectRoot();
  const config = await readPromptConfig(root);
  const prompts = await Promise.all(
    PROMPT_KEYS.map((key) => readPromptEntry(root, config.overrides, key, config.valid)),
  );
  const warnings = [
    ...(config.warning ? [config.warning] : []),
    ...prompts.filter((prompt) => !isPromptReady(prompt)).map((prompt) => prompt.message),
  ];

  return {
    checkedAt: new Date().toISOString(),
    configSource: config.source,
    configValid: config.valid,
    passed: config.valid && prompts.every(isPromptReady),
    projectRoot: root,
    prompts,
    warnings,
  };
}

async function readPromptEntry(
  root: string,
  overrides: Partial<Record<PromptOverrideConfigKey, string>>,
  key: PromptKey,
  configValid: boolean,
): Promise<StudioPromptEntry> {
  const definition = PROMPT_TEMPLATE_DEFINITIONS[key];
  const defaultResult = await readPromptFile(root, definition.defaultPath);
  const base = {
    contractMarker: definition.contractMarker,
    defaultHash: defaultResult.hash,
    defaultPath: definition.defaultPath,
    key,
    label: definition.label,
  };
  if (!configValid) {
    return {
      ...base,
      message:
        "Producer config is invalid. Studio cannot trust prompt overrides; run pnpm producer doctor.",
      mode: "unknown",
      nextAction: "pnpm producer doctor",
      overridePath: null,
      selectedHash: null,
      selectedPath: null,
      status: "config-invalid",
    };
  }

  const overrideResult = resolvePromptOverride(key, overrides);
  if (overrideResult.error) {
    return {
      ...base,
      message: overrideResult.error,
      mode: "override",
      nextAction: "Edit producer.config.json or run pnpm producer doctor.",
      overridePath: overrideResult.configuredPath,
      selectedHash: null,
      selectedPath: null,
      status: "override-invalid",
    };
  }
  if (overrideResult.path) {
    return entryFromOverride(root, overrideResult.path, base);
  }
  return entryFromDefault(defaultResult, base);
}

function entryFromDefault(
  defaultResult: PromptFileReadResult,
  base: Pick<StudioPromptEntry, "contractMarker" | "defaultHash" | "defaultPath" | "key" | "label">,
): StudioPromptEntry {
  if (defaultResult.status !== "ready") {
    return {
      ...base,
      message: `Runtime prompt default ${defaultResult.status}: ${base.defaultPath}.`,
      mode: "default",
      nextAction: "Restore tracked prompts/defaults files, then run pnpm producer doctor.",
      overridePath: null,
      selectedHash: null,
      selectedPath: base.defaultPath,
      status: defaultResult.status === "empty" ? "default-empty" : "default-missing",
    };
  }
  return {
    ...base,
    message: "Tracked runtime default prompt is ready.",
    mode: "default",
    nextAction: "No action. Configure prompts/local only for explicit local experiments.",
    overridePath: null,
    selectedHash: defaultResult.hash,
    selectedPath: base.defaultPath,
    status: "default-ready",
  };
}

async function entryFromOverride(
  root: string,
  overridePathValue: string,
  base: Pick<StudioPromptEntry, "contractMarker" | "defaultHash" | "defaultPath" | "key" | "label">,
): Promise<StudioPromptEntry> {
  const overrideResult = await readPromptFile(root, overridePathValue);
  if (overrideResult.status !== "ready") {
    return {
      ...base,
      message: `Runtime prompt override ${overrideResult.status}: ${overridePathValue}.`,
      mode: "override",
      nextAction: "Fix or remove the local prompt override, then run pnpm producer doctor.",
      overridePath: overridePathValue,
      selectedHash: null,
      selectedPath: overridePathValue,
      status: overrideResult.status === "empty" ? "override-empty" : "override-missing",
    };
  }
  return {
    ...base,
    message: "Explicit local prompt override is active and non-empty.",
    mode: "override",
    nextAction: "Review local prompt diff before provider-backed generation.",
    overridePath: overridePathValue,
    selectedHash: overrideResult.hash,
    selectedPath: overridePathValue,
    status: "override-ready",
  };
}

function resolvePromptOverride(
  key: PromptKey,
  overrides: Partial<Record<PromptOverrideConfigKey, string>>,
): { configuredPath: string | null; error: string | null; path: string | null } {
  const configuredPath = overrides[PROMPT_TEMPLATE_DEFINITIONS[key].overrideConfigKey] ?? null;
  if (!configuredPath) {
    return { configuredPath, error: null, path: null };
  }
  if (!isValidPromptOverridePath(configuredPath)) {
    return {
      configuredPath,
      error: "Runtime prompt overrides must be Markdown files under prompts/local/.",
      path: null,
    };
  }
  return { configuredPath, error: null, path: configuredPath };
}

type PromptFileReadResult =
  { hash: string; status: "ready" } | { hash: null; status: "empty" | "missing" };

async function readPromptFile(root: string, relativePath: string): Promise<PromptFileReadResult> {
  const target = path.join(/* turbopackIgnore: true */ root, relativePath);
  if (!(await fileExists(target))) {
    return { hash: null, status: "missing" };
  }
  const text = (await readFile(target, "utf8")).trim();
  if (!text) {
    return { hash: null, status: "empty" };
  }
  return { hash: sha256(text), status: "ready" };
}

async function readPromptConfig(root: string): Promise<PromptConfigReadResult> {
  const target = resolveProducerConfigPath(root);
  const source = formatProjectPath(root, target);
  if (!(await fileExists(target))) {
    return { overrides: {}, source: "default config", valid: true, warning: null };
  }

  try {
    const raw = JSON.parse(await readFile(target, "utf8")) as unknown;
    return {
      overrides: producerConfigSchema.parse(raw).prompts.overrides,
      source,
      valid: true,
      warning: null,
    };
  } catch {
    return {
      overrides: {},
      source,
      valid: false,
      warning:
        "Producer config is invalid. Prompt inventory cannot trust configured local overrides.",
    };
  }
}

function isPromptReady(prompt: StudioPromptEntry): boolean {
  return prompt.status === "default-ready" || prompt.status === "override-ready";
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
