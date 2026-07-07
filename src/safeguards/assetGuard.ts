import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ProducerConfig } from "../config/schema.js";

export type AssetCheck = { passed: boolean; warnings: string[]; found: Record<string, string[]> };

/**
 * Verifies the availability of required asset files in configured directories.
 *
 * Searches the configured brand, overlay, intro, and outro asset directories under `root`
 * and reports any missing required asset categories.
 *
 * @param config - Producer configuration containing asset directory paths.
 * @param root - Base directory used to resolve the configured asset paths.
 * @returns An `AssetCheck` object with the check result, warning messages, and discovered files by category.
 */
export async function checkAssets(
  config: Pick<ProducerConfig, "assets">,
  root?: string,
): Promise<AssetCheck> {
  const baseRoot = root ?? process.cwd();
  const brand = await listFilesIfExists(path.join(baseRoot, config.assets.brandDir));
  const overlays = await listFilesIfExists(path.join(baseRoot, config.assets.overlayDir));
  const intro = await listFilesIfExists(path.join(baseRoot, config.assets.introDir));
  const outro = await listFilesIfExists(path.join(baseRoot, config.assets.outroDir));
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
  return { passed: warnings.length === 0, warnings, found: { brand, overlays, intro, outro } };
}

async function listFilesIfExists(directory: string): Promise<string[]> {
  try {
    return await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
