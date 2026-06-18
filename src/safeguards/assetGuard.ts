import path from "node:path";
import { ProducerConfig } from "../config/schema";
import { listFilesIfExists } from "../utils/fs";

export type AssetCheck = {
  passed: boolean;
  warnings: string[];
  found: Record<string, string[]>;
};

export async function checkAssets(config: ProducerConfig): Promise<AssetCheck> {
  const brand = await listFilesIfExists(path.join(process.cwd(), config.assets.brandDir));
  const overlays = await listFilesIfExists(path.join(process.cwd(), config.assets.overlayDir));
  const intro = await listFilesIfExists(path.join(process.cwd(), config.assets.introDir));
  const outro = await listFilesIfExists(path.join(process.cwd(), config.assets.outroDir));
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
