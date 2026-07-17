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
  };

  it.each([
    ["static", "static-fallback"],
    ["manual-import", "manual-import"],
    ["black-forest-labs", "hosted-generation"],
  ] as const)(
    "accepts valid provider %s with source %s",
    (provider, sourceKind) => {
      const revision = { ...baseRevision, provider, source: sources[sourceKind] };
      expect(() => visualRevisionSchema.parse(revision)).not.toThrow();
    },
  );

  it.each([
    ["static", "manual-import"],
    ["static", "hosted-generation"],
    ["manual-import", "static-fallback"],
    ["manual-import", "hosted-generation"],
    ["black-forest-labs", "static-fallback"],
    ["black-forest-labs", "manual-import"],
  ] as const)(
    "rejects mismatched provider %s with source %s",
    (provider, sourceKind) => {
      const revision = { ...baseRevision, provider, source: sources[sourceKind] };
      expect(() => visualRevisionSchema.parse(revision)).toThrow(
        "Visual revision provider does not match its source kind",
      );
    },
  );
});
