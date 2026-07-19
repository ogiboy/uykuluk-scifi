import { describe, expect, it } from "vitest";

import { visualRevisionSchema } from "../src/stages/visuals/visualContracts";

const digest = "a".repeat(64);

describe("visual revision contracts", () => {
  const baseRevision = {
    revision: 1,
    createdAt: "2026-07-15T00:00:00.000Z",
    asset: { role: "scene-visual" as const, path: "production/visuals/scene-01.png", digest },
    media: { bytes: 100, format: "png" as const, height: 1080, width: 1920 },
    motion: {
      kind: "slow-zoom-in" as const,
      pan: "center" as const,
      seed: 1,
      zoomEnd: 1.08,
      zoomStart: 1,
    },
  };

  const sources = {
    "static-fallback": {
      kind: "static-fallback" as const,
      sourceAssetDigest: digest,
      sourceAssetPath: "production/visuals/scene-01.png",
    },
    "manual-import": {
      kind: "manual-import" as const,
      originalFileName: "imported.png",
      sourceDigest: digest,
    },
    "hosted-generation": {
      kind: "hosted-generation" as const,
      service: "black-forest-labs" as const,
      modelId: "flux-2-pro" as const,
      operationId: `image_${digest}`,
      planDigest: digest,
      quoteDigest: digest,
      approvalId: "approval_visual_contract",
      reservationId: "reservation_visual_contract",
      resultSpool: { path: "operations/image/result.json", digest },
      providerRequestIdHash: digest,
      billableCredits: 10,
      actualUsdMicros: 100_000,
    },
    "local-generation": {
      kind: "local-generation" as const,
      service: "mflux" as const,
      modelId: "mlx-community/flux2-klein-4b-4bit",
      modelRevision: "860e87183ceb29e39627c0612ebd66d8ea66e68c",
      runtimeRevision: "0.18.0",
      operationId: "local_image_contract_test",
      settingsDigest: digest,
      promptDigest: digest,
      quantization: "q4" as const,
      seed: 42_001,
      steps: 4,
      guidance: 1,
      dimensions: { width: 1024, height: 576 },
      durationMs: 100,
    },
  };

  it.each([
    ["static", "static-fallback"],
    ["manual-import", "manual-import"],
    ["black-forest-labs", "hosted-generation"],
    ["mflux-local", "local-generation"],
  ] as const)("accepts valid provider %s with source %s", (provider, sourceKind) => {
    const revision = { ...baseRevision, provider, source: sources[sourceKind] };
    expect(() => visualRevisionSchema.parse(revision)).not.toThrow();
  });

  it.each([
    ["static", "manual-import"],
    ["static", "hosted-generation"],
    ["manual-import", "static-fallback"],
    ["manual-import", "hosted-generation"],
    ["black-forest-labs", "static-fallback"],
    ["black-forest-labs", "manual-import"],
    ["mflux-local", "static-fallback"],
    ["mflux-local", "manual-import"],
    ["mflux-local", "hosted-generation"],
  ] as const)("rejects mismatched provider %s with source %s", (provider, sourceKind) => {
    const revision = { ...baseRevision, provider, source: sources[sourceKind] };
    expect(() => visualRevisionSchema.parse(revision)).toThrow(
      "Visual revision provider does not match its source kind",
    );
  });
});
