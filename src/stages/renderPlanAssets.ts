import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ProducerConfig } from "../config/schema.js";
import { SafeExitError } from "../core/errors.js";
import { pathExists } from "../utils/fs.js";
import { AssetRef } from "./renderPlanSchemas.js";

export type SelectedRenderAssets = {
  backgrounds: AssetRef[];
  factCheckIcon?: AssetRef;
  introFrames: AssetRef[];
  introSource: AssetRef;
  logo: AssetRef;
  lowerThird?: AssetRef;
  outroFrames: AssetRef[];
  outroSource: AssetRef;
  popupCard?: AssetRef;
  subtitlePanel: AssetRef;
  watermark: AssetRef;
  waveform?: AssetRef;
};

/**
 * Selects the render assets used to build a render plan.
 *
 * @param configAssets - Asset directories from the producer configuration
 * @returns The selected render assets, including required single assets, optional overlays, frame sequences, and background plates
 */
export async function selectRenderAssets(
  configAssets: ProducerConfig["assets"],
): Promise<SelectedRenderAssets> {
  const brand = await listAssetRefs(configAssets.brandDir);
  const overlays = await listAssetRefs(configAssets.overlayDir);
  const intro = await listAssetRefs(configAssets.introDir);
  const introFrames = await listAssetRefs(
    path.posix.join(toPosix(configAssets.introDir), "frames"),
    "intro-source-frame",
  );
  const outro = await listAssetRefs(configAssets.outroDir);
  const outroFrames = await listAssetRefs(
    path.posix.join(toPosix(configAssets.outroDir), "frames"),
    "outro-source-frame",
  );
  const backgrounds = await listAssetRefs("assets/backgrounds", "background-plate");
  return {
    backgrounds: requireSome(backgrounds, "background-plate"),
    factCheckIcon: await firstAsset("assets/icons", /fact|check/i, "fact-check-icon"),
    introFrames,
    introSource: requireOne(intro, /./, "intro-source"),
    logo: requireOne(brand, /logo/i, "logo"),
    lowerThird: findAsset(overlays, /lower|third/i, "lower-third"),
    outroFrames,
    outroSource: requireOne(outro, /./, "outro-source"),
    popupCard: findAsset(overlays, /popup|card/i, "popup-card"),
    subtitlePanel: requireOne(overlays, /subtitle|panel/i, "subtitle-panel"),
    watermark: requireOne(brand, /watermark/i, "watermark"),
    waveform: await firstAsset("assets/waveforms", /waveform/i, "waveform-overlay"),
  };
}

export function uniqueAssets(assets: Array<AssetRef | undefined>): AssetRef[] {
  const seen = new Set<string>();
  return assets.filter((asset): asset is AssetRef => {
    if (!asset || seen.has(asset.path)) {
      return false;
    }
    seen.add(asset.path);
    return true;
  });
}

/**
 * Lists asset references for files in a directory.
 *
 * Returns an empty array when the directory does not exist.
 *
 * @param relativeDir - Directory path relative to the current working directory
 * @param role - Role assigned to each asset reference
 * @returns The asset references for files in the directory
 */
async function listAssetRefs(relativeDir: string, role = "asset"): Promise<AssetRef[]> {
  const absoluteDir = path.join(process.cwd(), relativeDir);
  if (!(await pathExists(absoluteDir))) {
    return [];
  }
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => assetRef(role, path.posix.join(toPosix(relativeDir), entry.name))),
  );
}

async function firstAsset(
  relativeDir: string,
  pattern: RegExp,
  role: string,
): Promise<AssetRef | undefined> {
  return findAsset(await listAssetRefs(relativeDir), pattern, role);
}

function requireSome(assets: AssetRef[], role: string): AssetRef[] {
  if (assets.length === 0) {
    throw new SafeExitError(`Missing render planning asset: ${role}.`);
  }
  return assets.map((asset) => ({ ...asset, role }));
}

function requireOne(assets: AssetRef[], pattern: RegExp, role: string): AssetRef {
  const asset = findAsset(assets, pattern, role);
  if (!asset) {
    throw new SafeExitError(`Missing render planning asset: ${role}.`);
  }
  return asset;
}

function findAsset(assets: AssetRef[], pattern: RegExp, role: string): AssetRef | undefined {
  const match = assets.find((asset) => pattern.test(path.basename(asset.path)));
  return match ? { ...match, role } : undefined;
}

async function assetRef(role: string, relativePath: string): Promise<AssetRef> {
  const normalized = toPosix(relativePath);
  if (!normalized.startsWith("assets/")) {
    throw new SafeExitError(`Render planning asset must live under assets/: ${normalized}`);
  }
  const bytes = await readFile(path.join(process.cwd(), normalized));
  return {
    role,
    path: normalized,
    digest: createHash("sha256").update(bytes).digest("hex"),
  };
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}
