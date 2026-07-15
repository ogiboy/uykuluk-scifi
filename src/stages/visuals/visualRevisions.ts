import { createHash } from "node:crypto";
import { SafeExitError } from "../../core/errors.js";
import type { CostReservationSummary } from "../../costs/costReservationStore.js";
import { nowIso } from "../../utils/time.js";
import { requireSettledHostedVisualSpool } from "./hostedVisualSpoolEvidence.js";
import type { VisualRevision } from "./visualContracts.js";
import type { LoadedHostedVisualGenerationSpool } from "./visualGenerationSpool.js";
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

/** Builds one immutable hosted revision from a settled batch spool. */
export function hostedVisualRevision(
  spool: LoadedHostedVisualGenerationSpool,
  reservation: CostReservationSummary,
  sceneIndex: number,
  revision: number,
): VisualRevision {
  requireSettledHostedVisualSpool({
    spool,
    reservation,
    planDigest: spool.spool.plan.digest,
    approvedQuote: spool.spool.approvedQuote,
  });
  const imageIndex = spool.spool.images.findIndex((image) => image.sceneIndex === sceneIndex);
  const image = spool.spool.images[imageIndex];
  if (!image || !image.providerRequest.requestIdHash || reservation.status !== "SETTLED") {
    throw new SafeExitError(`Hosted visual scene ${sceneIndex} has no settled spool image.`);
  }
  return {
    revision,
    provider: "black-forest-labs",
    createdAt: nowIso(),
    asset: { role: "scene-visual", path: image.asset.path, digest: image.asset.sha256 },
    media: image.media,
    motion: deterministicVisualMotion(sceneIndex, revision),
    source: {
      kind: "hosted-generation",
      service: spool.spool.provider.service,
      modelId: spool.spool.provider.modelId,
      operationId: spool.spool.operationId,
      planDigest: spool.spool.plan.digest,
      quoteDigest: spool.spool.approvedQuote.quoteDigest,
      approvalId: spool.spool.approvedQuote.approvalId,
      reservationId: reservation.reservationId,
      resultSpool: { path: spool.reference.path, digest: spool.reference.digest },
      providerRequestIdHash: image.providerRequest.requestIdHash,
      billableCredits: image.billing.billableCredits,
      actualUsdMicros: image.billing.derivedUsdMicros,
    },
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
