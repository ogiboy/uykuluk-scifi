import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AssetRef } from "../render/renderPlanSchemas.js";
import type { VisualMedia } from "./visualContracts.js";
import { inspectVisualImage } from "./visualImageMetadata.js";

export type VisualProviderInput = Readonly<{
  revision: number;
  runId: string;
  sceneIndex: number;
  visualPrompt: string;
}>;

export type VisualProviderResult =
  | Readonly<{
      provider: "static";
      asset: AssetRef;
      source: { kind: "static-fallback"; sourceAssetDigest: string; sourceAssetPath: string };
    }>
  | Readonly<{
      provider: "manual-import";
      bytes: Buffer;
      extension: "jpg" | "png";
      media: VisualMedia;
      source: { kind: "manual-import"; originalFileName: string; sourceDigest: string };
    }>;

/** Replaceable boundary for static, manual, and future hosted scene-image providers. */
export interface VisualProvider {
  readonly provider: VisualProviderResult["provider"];
  createSceneVisual(input: VisualProviderInput): Promise<VisualProviderResult>;
}

export class StaticVisualProvider implements VisualProvider {
  readonly provider = "static" as const;

  constructor(private readonly backgrounds: readonly AssetRef[]) {}

  async createSceneVisual(input: VisualProviderInput): Promise<VisualProviderResult> {
    const asset =
      this.backgrounds[(input.sceneIndex + input.revision - 2) % this.backgrounds.length];
    if (!asset) {
      throw new Error("Static visual provider requires at least one background asset.");
    }
    return {
      provider: this.provider,
      asset: { ...asset, role: "scene-visual" },
      source: {
        kind: "static-fallback",
        sourceAssetDigest: asset.digest,
        sourceAssetPath: asset.path,
      },
    };
  }
}

export class ManualImportVisualProvider implements VisualProvider {
  readonly provider = "manual-import" as const;

  constructor(private readonly sourcePath: string) {}

  async createSceneVisual(_input: VisualProviderInput): Promise<VisualProviderResult> {
    const bytes = await readFile(this.sourcePath);
    const media = await inspectVisualImage(bytes);
    return {
      provider: this.provider,
      bytes,
      extension: media.format === "jpeg" ? "jpg" : "png",
      media,
      source: {
        kind: "manual-import",
        originalFileName: path.basename(this.sourcePath).slice(0, 240),
        sourceDigest: createHash("sha256").update(bytes).digest("hex"),
      },
    };
  }
}
