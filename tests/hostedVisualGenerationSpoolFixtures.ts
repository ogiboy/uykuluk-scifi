import { createHash } from "node:crypto";

import { defaultConfig } from "../src/config/config";
import type { CostReservationSummary } from "../src/costs/costReservationStore";
import type { BlackForestLabsFlux2ProBatchResult } from "../src/stages/visuals/providers/blackForestLabsFlux2ProBatch";
import type { VisualManifest } from "../src/stages/visuals/visualContracts";
import { createHostedVisualGenerationOperationId } from "../src/stages/visuals/visualGenerationOperation";
import { buildHostedVisualGenerationPlan } from "../src/stages/visuals/visualGenerationPlan";
import type { persistHostedVisualGenerationSpool } from "../src/stages/visuals/visualGenerationSpool";
import { deterministicVisualMotion } from "../src/stages/visuals/visualMotion";
import { sha256 } from "../src/utils/hash";

/**
 * Builds a settled cost reservation summary for a hosted visual generation operation.
 *
 * @param loaded - Persisted spool data containing reservation and result evidence details
 * @param planDigest - Digest binding the reservation to the generation plan
 * @param approvedQuote - Approved quote identifiers associated with the reservation
 * @returns A settled cost reservation summary
 */
export function settledReservation(
  loaded: Awaited<ReturnType<typeof persistHostedVisualGenerationSpool>>,
  planDigest: string,
  approvedQuote: { approvalId: string; quoteDigest: string },
): CostReservationSummary {
  return {
    reservationId: loaded.spool.reservationId,
    runId: loaded.spool.runId,
    operationId: loaded.spool.operationId,
    approvalId: approvedQuote.approvalId,
    quoteDigest: approvedQuote.quoteDigest,
    stage: "imageGeneration",
    provider: "black-forest-labs",
    model: "flux-2-pro",
    bindingDigest: planDigest,
    maxUsdMicros: loaded.spool.actualUsdMicros + 1,
    status: "SETTLED",
    actualUsdMicros: loaded.spool.actualUsdMicros,
    providerRequestIdHash: loaded.spool.providerRequestIdHash,
    resultEvidenceDigest: loaded.reference.digest,
    reservedAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
  };
}

/**
 * Builds a deterministic hosted visual generation plan fixture for testing.
 *
 * @returns A hosted visual generation plan containing static scene data and image generation configuration.
 */
export function generationPlan() {
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

/**
 * Creates an operation identifier for a hosted visual generation request.
 *
 * @param runId - The run identifier.
 * @param planDigest - The digest of the generation plan.
 * @param approvedQuote - The approved quote identifiers used for the operation.
 * @returns The generated operation identifier.
 */
export function operationId(
  runId: string,
  planDigest: string,
  approvedQuote: { approvalId: string; quoteDigest: string },
): string {
  return createHostedVisualGenerationOperationId({ runId, planDigest, ...approvedQuote });
}

/**
 * Builds a deterministic batch result with per-scene image outputs, provider request metadata, and billing details.
 *
 * @param plan - The hosted visual generation plan whose scenes determine the batch entries.
 * @returns The generated image results and corresponding provider request records.
 */
export function batchResult(
  plan: ReturnType<typeof generationPlan>,
): BlackForestLabsFlux2ProBatchResult {
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

/**
 * Computes a deterministic digest for a generated plan artifact.
 *
 * @param plan - The generated plan to digest
 * @returns The SHA-256 digest of the plan's formatted JSON representation
 */
export function planArtifactDigest(plan: ReturnType<typeof generationPlan>): string {
  return sha256(`${JSON.stringify(plan, null, 2)}\n`);
}
