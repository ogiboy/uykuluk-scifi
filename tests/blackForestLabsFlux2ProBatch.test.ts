import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config/config";
import type { ReservedProviderCallContext } from "../src/costs/reservedProviderExecution";
import { createBlackForestLabsFlux2ProBatchAdapter } from "../src/stages/visuals/providers/blackForestLabsFlux2ProBatch";
import type { BlackForestLabsFlux2ProResult } from "../src/stages/visuals/providers/blackForestLabsFlux2ProContracts";
import type { VisualManifest } from "../src/stages/visuals/visualContracts";
import { buildHostedVisualGenerationPlan } from "../src/stages/visuals/visualGenerationPlan";
import { deterministicVisualMotion } from "../src/stages/visuals/visualMotion";

function result(sceneIndex: number): BlackForestLabsFlux2ProResult {
  const buffer = Buffer.from(`image-${sceneIndex}`);
  return {
    buffer,
    digest: String(sceneIndex).repeat(64).slice(0, 64),
    extension: "jpg",
    media: { bytes: buffer.byteLength, format: "jpeg", width: 1920, height: 1080 },
    provider: { service: "black-forest-labs", modelId: "flux-2-pro", outputFormat: "jpeg" },
    providerBilling: {
      source: "provider-reported-credits-approved-tariff-derived-usd",
      billableCredits: 9,
      usdPerCredit: 0.01,
      derivedUsdMicros: 90_000,
    },
    providerRequest: {
      inputDigest: "a".repeat(64),
      requestIdHash: String(sceneIndex).repeat(64).slice(0, 64),
    },
  };
}

function plan() {
  const revision = {
    revision: 1,
    provider: "static" as const,
    createdAt: "2026-07-15T00:00:00.000Z",
    asset: { role: "scene-visual" as const, path: "assets/a.jpg", digest: "a".repeat(64) },
    motion: deterministicVisualMotion(1, 1),
    source: {
      kind: "static-fallback" as const,
      sourceAssetDigest: "a".repeat(64),
      sourceAssetPath: "assets/a.jpg",
    },
  };
  const manifest = {
    schemaVersion: 1 as const,
    runId: "run_batch",
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
      promptDigest: "c".repeat(64),
      activeRevision: 1,
      revisions: [revision],
    })),
  } satisfies VisualManifest;
  const config = {
    ...defaultConfig.providers.imageGeneration,
    enabled: true,
    mode: "black-forest-labs" as const,
  };
  return buildHostedVisualGenerationPlan({
    runId: manifest.runId,
    createdAt: manifest.createdAt,
    visualManifest: manifest,
    visualManifestDigest: "d".repeat(64),
    purpose: "initial",
    sceneIndexes: [1, 2],
    config,
  });
}

function context(planDigest: string): ReservedProviderCallContext {
  return {
    reservationId: "reservation_batch",
    operationId: "image_operation",
    provider: "black-forest-labs",
    model: "flux-2-pro",
    bindingDigest: planDigest,
    maxUsdMicros: 180_000,
    signal: new AbortController().signal,
  };
}

describe("FLUX.2 Pro batch adapter", () => {
  it("executes scenes sequentially and returns aggregate billing evidence", async () => {
    const generationPlan = plan();
    let active = 0;
    let maximumActive = 0;
    const executeScene = vi.fn(async ({ sceneIndex }: { sceneIndex: number }) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      return {
        kind: "success" as const,
        value: result(sceneIndex),
        actualUsdMicros: 90_000,
        providerRequestId: `request-${sceneIndex}`,
      };
    });
    const adapter = createBlackForestLabsFlux2ProBatchAdapter({
      plan: generationPlan,
      bindingDigest: generationPlan.bindingDigest,
      dependencies: { executeScene: executeScene as never },
    });

    const outcome = await adapter.execute(context(generationPlan.bindingDigest));

    expect(outcome).toMatchObject({ kind: "success", actualUsdMicros: 180_000 });
    expect(maximumActive).toBe(1);
    expect(executeScene).toHaveBeenCalledTimes(2);
  });

  it("stops after an uncertain scene and preserves prior request evidence", async () => {
    const generationPlan = plan();
    const executeScene = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "success",
        value: result(1),
        actualUsdMicros: 90_000,
        providerRequestId: "request-1",
      })
      .mockResolvedValueOnce({
        kind: "unknown",
        reason: "provider-error",
        providerRequestId: "request-2",
        requestEvidence: [
          { requestIndex: 1, inputDigest: "b".repeat(64), requestIdHash: "e".repeat(64) },
        ],
      });
    const adapter = createBlackForestLabsFlux2ProBatchAdapter({
      plan: generationPlan,
      bindingDigest: generationPlan.bindingDigest,
      dependencies: { executeScene: executeScene as never },
    });

    const outcome = await adapter.execute(context(generationPlan.bindingDigest));

    expect(outcome).toMatchObject({
      kind: "unknown",
      reason: "provider-error",
      requestEvidence: [{ requestIndex: 0 }, { requestIndex: 1 }],
    });
    expect(executeScene).toHaveBeenCalledTimes(2);
  });
});
