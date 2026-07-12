import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { producerConfigSchema } from "../../../../../src/config/schema";
import { DEFAULT_ASSET_CONFIG, type StudioAssetConfig } from "./assetInventoryDefinitions";

export type ConfigReadResult = {
  assets: StudioAssetConfig;
  source: string;
  valid: boolean;
  warning: string | null;
};

export async function readStudioProducerConfig(root: string): Promise<ConfigReadResult> {
  const target = resolveProducerConfigPath(root);
  const source = formatProjectPath(root, target);
  if (!(await fileExists(target))) {
    return { assets: DEFAULT_ASSET_CONFIG, source: "default config", valid: true, warning: null };
  }

  try {
    const raw = JSON.parse(await readFile(target, "utf8")) as unknown;
    return { assets: producerConfigSchema.parse(raw).assets, source, valid: true, warning: null };
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

export function formatProjectPath(root: string, target: string): string {
  const relativePath = path.relative(root, target);
  if (!relativePath || relativePath.startsWith("..")) {
    return target;
  }
  return relativePath.replaceAll(path.sep, "/");
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

export function resolveProducerConfigPath(root: string): string {
  const configuredPath = process.env.PRODUCER_CONFIG ?? "producer.config.json";
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  return path.join(/* turbopackIgnore: true */ root, configuredPath);
}
