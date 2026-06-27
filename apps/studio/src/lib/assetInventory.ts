import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { checkAssets } from "../../../../src/safeguards/assetGuard";
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

/**
 * Builds an inventory of the studio asset configuration and directory contents.
 *
 * @returns The computed asset inventory, including category results, warnings, timestamps, and overall status.
 */
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

/**
 * Reads the producer asset configuration for a project.
 *
 * @param root - The project root directory
 * @returns The resolved asset configuration, its source, validity, and any warning message
 */
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

/**
 * Checks whether a path exists.
 *
 * @returns `true` if the path exists, `false` if it does not.
 */
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

/**
 * Checks the expected asset directories for missing brand and intro/outro assets.
 *
 * @param root - Project root used to resolve asset directories
 * @param assets - Asset directory configuration
 * @returns Warning messages for any missing expected assets
 */
async function readAssetGuardWarnings(root: string, assets: StudioAssetConfig): Promise<string[]> {
  return (await checkAssets({ assets }, root)).warnings;
}

/**
 * Resolves the producer config path for the project.
 *
 * @param root - The project root directory
 * @returns The absolute config path from `PRODUCER_CONFIG`, or the path to `producer.config.json` under `root`
 */
function resolveProducerConfigPath(root: string): string {
  const configuredPath = process.env.PRODUCER_CONFIG ?? "producer.config.json";
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  return path.join(/* turbopackIgnore: true */ root, configuredPath);
}

/**
 * Builds the inventory entry for a single asset category.
 *
 * @param root - Project root used to resolve and format file paths
 * @param assets - Studio asset configuration
 * @param definition - Category metadata and directory definition
 * @param guardWarnings - Guard warnings collected for the project
 * @returns The completed asset category inventory entry
 */
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

/**
 * Filters guard warnings for a specific asset category.
 *
 * @param definition - The category definition to match against
 * @param guardWarnings - The guard warnings to filter
 * @returns The warnings that match the category's guarded warning pattern
 */
function warningsForCategory(
  definition: AssetCategoryDefinition,
  guardWarnings: readonly string[],
): string[] {
  if (!definition.guardedWarningPattern) {
    return [];
  }
  return guardWarnings.filter((warning) => definition.guardedWarningPattern?.test(warning));
}

/**
 * Resolves the directory for an asset category.
 *
 * @param definition - The category definition that may point to a configured asset directory
 * @returns The configured directory for the category, or the default directory from the definition
 */
function resolveAssetDirectory(
  assets: StudioAssetConfig,
  definition: AssetCategoryDefinition,
): string {
  if (definition.configuredDirectory) {
    return assets[definition.configuredDirectory];
  }
  return definition.directory;
}

/**
 * Determines the status of an asset category.
 *
 * @param files - The discovered files for the category
 * @param warnings - The warnings associated with the category
 * @returns `"needs-action"` if any warnings exist, `"empty"` if no files are found, otherwise `"ready"`
 */
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

/**
 * Lists all files under a directory and returns project-relative paths.
 *
 * @param root - Project root used to normalize returned paths
 * @param directory - Directory to scan
 * @returns Sorted file paths relative to `root`
 */
async function listAssetFiles(root: string, directory: string): Promise<string[]> {
  const fullDirectory = path.join(/* turbopackIgnore: true */ root, directory);
  const files = await listFilesRecursively(fullDirectory);
  return files
    .map((file) => formatProjectPath(root, file))
    .sort((first, second) => first.localeCompare(second));
}

/**
 * Lists all files under a directory.
 *
 * @param directory - The directory to scan
 * @returns The full paths of all files found under `directory`
 */
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

/**
 * Reads the entries in a directory.
 *
 * Returns an empty array when the directory does not exist.
 *
 * @param directory - The directory to read
 * @returns The directory entries, or an empty array if the directory is missing
 */
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

/**
 * Formats a path relative to the project root.
 *
 * @param root - Project root used as the reference point
 * @param target - Path to format
 * @returns A project-relative path with `/` separators, or `target` when it is outside `root`
 */
function formatProjectPath(root: string, target: string): string {
  const relativePath = path.relative(root, target);
  if (!relativePath || relativePath.startsWith("..")) {
    return target;
  }
  return relativePath.replaceAll(path.sep, "/");
}
