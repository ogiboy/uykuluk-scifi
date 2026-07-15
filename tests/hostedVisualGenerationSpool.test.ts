import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import type { BlackForestLabsFlux2ProBatchResult } from "../src/stages/visuals/providers/blackForestLabsFlux2ProBatch";
import type { VisualManifest } from "../src/stages/visuals/visualContracts";
import { buildHostedVisualGenerationPlan } from "../src/stages/visuals/visualGenerationPlan";
import {
  loadHostedVisualGenerationSpool,
  persistHostedVisualGenerationSpool,
} from "../src/stages/visuals/visualGenerationSpool";
import { deterministicVisualMotion } from "../src/stages/visuals/visualMotion";
import { sha256 } from "../src/utils/hash";
import { useTempProject } from "./helpers";

describe("hosted visual generation spool", () => {
  useTempProject();

  it("persists and reloads exact batch image evidence", async () => {
    const plan = generationPlan();
    const result = batchResult(plan);
    const loaded = await persistHostedVisualGenerationSpool({
      runId: plan.runId,
      operationId: `image_${"f".repeat(64)}`,
      plan,
      planDigest: planArtifactDigest(plan),
      approvedQuote: { approvalId: "approval_visual", quoteDigest: "d".repeat(64) },
      reservationId: "reservation_visual",
      actualUsdMicros: 180_000,
      providerRequestId: "batch-provider-request",
      result,
    });

    expect(loaded.spool.images).toHaveLength(2);
    expect(loaded.images.map((image) => image.buffer.toString("utf8"))).toEqual([
      "image-1",
      "image-2",
    ]);
    expect(loaded.reference.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects tampered image bytes after the spool is committed", async () => {
    const plan = generationPlan();
    const loaded = await persistHostedVisualGenerationSpool({
      runId: plan.runId,
      operationId: `image_${"a".repeat(64)}`,
      plan,
      planDigest: planArtifactDigest(plan),
      approvedQuote: { approvalId: "approval_visual", quoteDigest: "d".repeat(64) },
      reservationId: "reservation_visual",
      actualUsdMicros: 180_000,
      providerRequestId: "batch-provider-request",
      result: batchResult(plan),
    });
    await writeFile(
      artifactPath(plan.runId, loaded.spool.images[0]!.asset.path),
      Buffer.from("tampered"),
    );

    await expect(loadHostedVisualGenerationSpool(plan.runId, loaded.reference)).rejects.toThrow(
      /spool image is invalid/i,
    );
  });
});

function generationPlan() {
  const manifest = {
    schemaVersion: 1 as const,
    runId: "run_spool",
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    productionPackage: {
      path: "production/production_package.meta.json" as const,
      digest: "b".repeat(64),
    },
    scenes: Array.from({ length: 12 }, (_, index) => ({
      sceneIndex: index + 1,
      productionSceneIndexes: [index + 1],
      durationSeconds: 5,
      visualPrompt: `prompt ${index + 1}`,
      promptDigest: sha256(`prompt ${index + 1}`),
      activeRevision: 1,
      revisions: [
        {
          revision: 1,
          provider: "static" as const,
          createdAt: "2026-07-15T00:00:00.000Z",
          asset: { role: "scene-visual" as const, path: "assets/a.jpg", digest: "a".repeat(64) },
          motion: deterministicVisualMotion(index + 1, 1),
          source: {
            kind: "static-fallback" as const,
            sourceAssetDigest: "a".repeat(64),
            sourceAssetPath: "assets/a.jpg",
          },
        },
      ],
    })),
  } satisfies VisualManifest;
  return buildHostedVisualGenerationPlan({
    runId: manifest.runId,
    createdAt: manifest.createdAt,
    visualManifest: manifest,
    visualManifestDigest: "c".repeat(64),
    purpose: "initial",
    sceneIndexes: [1, 2],
    config: {
      ...defaultConfig.providers.imageGeneration,
      enabled: true,
      mode: "black-forest-labs",
    },
  });
}

function batchResult(plan: ReturnType<typeof generationPlan>): BlackForestLabsFlux2ProBatchResult {
  const images = plan.scenes.map((scene) => {
    const buffer = Buffer.from(`image-${scene.sceneIndex}`);
    const requestIdHash = sha256(`request-${scene.sceneIndex}`);
    return {
      sceneIndex: scene.sceneIndex,
      promptDigest: scene.promptDigest,
      seed: scene.seed,
      result: {
        buffer,
        digest: createHash("sha256").update(buffer).digest("hex"),
        extension: "jpg" as const,
        media: { bytes: buffer.byteLength, format: "jpeg" as const, width: 1920, height: 1080 },
        provider: {
          service: "black-forest-labs" as const,
          modelId: "flux-2-pro" as const,
          outputFormat: "jpeg" as const,
        },
        providerBilling: {
          source: "provider-reported-credits-approved-tariff-derived-usd" as const,
          billableCredits: 9,
          usdPerCredit: 0.01 as const,
          derivedUsdMicros: 90_000,
        },
        providerRequest: { inputDigest: sha256(scene.prompt), requestIdHash },
      },
    };
  });
  return {
    images,
    providerRequests: images.map((image, index) => ({
      requestIndex: index,
      inputDigest: image.result.providerRequest.inputDigest,
      requestIdHash: image.result.providerRequest.requestIdHash,
      reportedUnits: image.result.providerBilling.billableCredits,
    })),
  };
}

function planArtifactDigest(plan: ReturnType<typeof generationPlan>): string {
  return sha256(`${JSON.stringify(plan, null, 2)}\n`);
}
