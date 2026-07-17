import { describe, expect, it } from "vitest";

import { visualRevisionSchema } from "../src/stages/visuals/visualContracts";

const digest = "a".repeat(64);

describe("visual revision contracts", () => {
  it("rejects a provider that contradicts the persisted source kind", () => {
    const revision = {
      revision: 1,
      provider: "static",
      createdAt: "2026-07-15T00:00:00.000Z",
      asset: { role: "scene-visual", path: "production/visuals/scene-01.png", digest },
      media: { bytes: 100, format: "png", height: 1080, width: 1920 },
      motion: { kind: "slow-zoom-in", pan: "center", seed: 1, zoomEnd: 1.08, zoomStart: 1 },
      source: {
        kind: "hosted-generation",
        service: "black-forest-labs",
        modelId: "flux-2-pro",
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

    expect(() => visualRevisionSchema.parse(revision)).toThrow(
      "Visual revision provider does not match its source kind",
    );
    expect(() =>
      visualRevisionSchema.parse({ ...revision, provider: "black-forest-labs" }),
    ).not.toThrow();
  });
});
