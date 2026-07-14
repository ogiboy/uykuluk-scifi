import { createHash } from "node:crypto";
import { SafeExitError } from "../../core/errors.js";
import { nowIso } from "../../utils/time.js";
import type { VisualRevision } from "./visualContracts.js";
import { deterministicVisualMotion } from "./visualMotion.js";
import type { VisualProvider, VisualProviderResult } from "./visualProvider.js";

export async function createStaticVisualRevision(
  provider: VisualProvider,
  input: { revision: number; runId: string; sceneIndex: number; visualPrompt: string },
): Promise<VisualRevision> {
  const result = await provider.createSceneVisual(input);
  if (result.provider !== "static") {
    throw new SafeExitError("Static visual preparation received a binary provider result.");
  }
  return {
    revision: input.revision,
    provider: result.provider,
    createdAt: nowIso(),
    asset: { ...result.asset, role: "scene-visual" },
    motion: deterministicVisualMotion(input.sceneIndex, input.revision),
    source: result.source,
  };
}

export function manualVisualRevision(
  result: Extract<VisualProviderResult, { provider: "manual-import" }>,
  sceneIndex: number,
  revision: number,
  relativePath: string,
): VisualRevision {
  return {
    revision,
    provider: result.provider,
    createdAt: nowIso(),
    asset: {
      role: "scene-visual",
      path: relativePath,
      digest: createHash("sha256").update(result.bytes).digest("hex"),
    },
    media: result.media,
    motion: deterministicVisualMotion(sceneIndex, revision),
    source: result.source,
  };
}

export function visualRevisionPath(
  sceneIndex: number,
  revision: number,
  extension: "jpg" | "png",
): string {
  const scene = String(sceneIndex).padStart(3, "0");
  const version = String(revision).padStart(3, "0");
  return `production/visuals/scenes/scene_${scene}/revision_${version}.${extension}`;
}
