import path from "node:path";
import { ProducerConfig } from "../config/schema.js";
import { listFilesIfExists } from "../utils/fs.js";

export type AssetCheck = {
  passed: boolean;
  warnings: string[];
  found: Record<string, string[]>;
};

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
  root: string = process.cwd(),
): Promise<AssetCheck> {
  const brand = await listFilesIfExists(path.join(root, config.assets.brandDir));
  const overlays = await listFilesIfExists(path.join(root, config.assets.overlayDir));
  const intro = await listFilesIfExists(path.join(root, config.assets.introDir));
  const outro = await listFilesIfExists(path.join(root, config.assets.outroDir));
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
  return {
    passed: warnings.length === 0,
    warnings,
    found: {
      brand,
      overlays,
      intro,
      outro,
    },
  };
}
