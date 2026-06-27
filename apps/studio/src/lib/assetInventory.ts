import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { producerConfigSchema } from "../../../../src/config/schema";
import {
  ASSET_CATEGORY_DEFINITIONS,
  DEFAULT_ASSET_CONFIG,
  type AssetCategoryDefinition,
  type StudioAssetCategory,
  type StudioAssetCategoryStatus,
  type StudioAssetConfig,
  type StudioAssetInventory,
} from "./assetInventoryDefinitions";
import { projectRoot } from "./projectRoot";

export type {
  StudioAssetCategory,
  StudioAssetCategoryStatus,
  StudioAssetInventory,
} from "./assetInventoryDefinitions";

type ConfigReadResult = {
  assets: StudioAssetConfig;
  source: string;
  valid: boolean;
  warning: string | null;
};

export async function getStudioAssetInventory(): Promise<StudioAssetInventory> {
  const root = projectRoot();
  const configRead = await readStudioProducerConfig(root);
  const assetWarnings = await readAssetGuardWarnings(root, configRead.assets);
  const categories = await Promise.all(
    ASSET_CATEGORY_DEFINITIONS.map((definition) =>
      readAssetCategory(root, configRead.assets, definition, assetWarnings),
    ),
  );
  const warnings = configRead.warning ? [configRead.warning, ...assetWarnings] : assetWarnings;

  return {
    categories,
    checkedAt: new Date().toISOString(),
    configSource: configRead.source,
    configValid: configRead.valid,
    passed: configRead.valid && assetWarnings.length === 0,
    projectRoot: root,
    totalFiles: categories.reduce((total, category) => total + category.files.length, 0),
    warnings,
  };
}

async function readStudioProducerConfig(root: string): Promise<ConfigReadResult> {
  const target = resolveProducerConfigPath(root);
  const source = formatProjectPath(root, target);
  if (!(await fileExists(target))) {
    return {
      assets: DEFAULT_ASSET_CONFIG,
      source: "default config",
      valid: true,
      warning: null,
    };
  }

  try {
    const raw = JSON.parse(await readFile(target, "utf8")) as unknown;
    return {
      assets: producerConfigSchema.parse(raw).assets,
      source,
      valid: true,
      warning: null,
    };
  } catch {
    return {
      assets: DEFAULT_ASSET_CONFIG,
      source,
      valid: false,
      warning:
        "Producer config is invalid. Asset inventory is shown from default asset paths only; run pnpm producer doctor before relying on readiness.",
    };
  }
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

async function readAssetGuardWarnings(root: string, assets: StudioAssetConfig): Promise<string[]> {
  const [brand, overlays, intro, outro] = await Promise.all([
    listDirectoryEntryNames(root, assets.brandDir),
    listDirectoryEntryNames(root, assets.overlayDir),
    listDirectoryEntryNames(root, assets.introDir),
    listDirectoryEntryNames(root, assets.outroDir),
  ]);
  const warnings: string[] = [];
  if (!brand.some((file) => /logo/i.test(file))) {
    warnings.push("Missing brand logo asset in assets/brand.");
  }
  if (!brand.some((file) => /watermark/i.test(file))) {
    warnings.push("Missing watermark asset in assets/brand.");
  }
  if (!overlays.some((file) => /(subtitle|lower|third|panel)/i.test(file))) {
    warnings.push("Missing subtitle panel or lower-third asset in assets/overlays.");
  }
  if (intro.length === 0) {
    warnings.push("Missing intro asset in assets/intro.");
  }
  if (outro.length === 0) {
    warnings.push("Missing outro asset in assets/outro.");
  }
  return warnings;
}

async function listDirectoryEntryNames(root: string, directory: string): Promise<string[]> {
  const entries = await readDirectoryEntries(
    path.join(/* turbopackIgnore: true */ root, directory),
  );
  return entries.map((entry) => entry.name);
}

function resolveProducerConfigPath(root: string): string {
  const configuredPath = process.env.PRODUCER_CONFIG ?? "producer.config.json";
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  return path.join(/* turbopackIgnore: true */ root, configuredPath);
}

async function readAssetCategory(
  root: string,
  assets: StudioAssetConfig,
  definition: AssetCategoryDefinition,
  guardWarnings: readonly string[],
): Promise<StudioAssetCategory> {
  const directory = resolveAssetDirectory(assets, definition);
  const warnings = warningsForCategory(definition, guardWarnings);
  const files = await listAssetFiles(root, directory);

  return {
    description: definition.description,
    directory,
    files,
    guarded: Boolean(definition.guardedWarningPattern),
    id: definition.id,
    label: definition.label,
    requiredFor: definition.requiredFor,
    status: categoryStatus(files, warnings),
    warnings,
  };
}

function warningsForCategory(
  definition: AssetCategoryDefinition,
  guardWarnings: readonly string[],
): string[] {
  if (!definition.guardedWarningPattern) {
    return [];
  }
  return guardWarnings.filter((warning) => definition.guardedWarningPattern?.test(warning));
}

function resolveAssetDirectory(
  assets: StudioAssetConfig,
  definition: AssetCategoryDefinition,
): string {
  if (definition.configuredDirectory) {
    return assets[definition.configuredDirectory];
  }
  return definition.directory;
}

function categoryStatus(
  files: readonly string[],
  warnings: readonly string[],
): StudioAssetCategoryStatus {
  if (warnings.length > 0) {
    return "needs-action";
  }
  if (files.length === 0) {
    return "empty";
  }
  return "ready";
}

async function listAssetFiles(root: string, directory: string): Promise<string[]> {
  const fullDirectory = path.join(/* turbopackIgnore: true */ root, directory);
  const files = await listFilesRecursively(fullDirectory);
  return files
    .map((file) => formatProjectPath(root, file))
    .sort((first, second) => first.localeCompare(second));
}

async function listFilesRecursively(directory: string): Promise<string[]> {
  const entries = await readDirectoryEntries(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(fullPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function readDirectoryEntries(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function formatProjectPath(root: string, target: string): string {
  const relativePath = path.relative(root, target);
  if (!relativePath || relativePath.startsWith("..")) {
    return target;
  }
  return relativePath.replaceAll(path.sep, "/");
}
