import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { producerConfigSchema } from "../src/config/schema";

describe("hosted visual configuration", () => {
  it("keeps legacy image generation configuration in static/manual mode", () => {
    const parsed = producerConfigSchema.parse({
      ...defaultConfig,
      providers: {
        ...defaultConfig.providers,
        imageGeneration: { enabled: false, requiresApproval: true },
      },
    });

    expect(parsed.providers.imageGeneration).toMatchObject({
      enabled: false,
      mode: "static-manual",
      flux2Pro: {
        model: "flux-2-pro",
        endpoint: "https://api.bfl.ai/v1/flux-2-pro",
        width: 1_920,
        height: 1_080,
        outputFormat: "jpeg",
        pricing: { usdPerMegapixel: 0.03, usdPerCredit: 0.01, maximumUsdPerImage: 0.09 },
      },
    });
  });

  it("rejects endpoint drift, oversized images, and caps below rounded megapixel pricing", () => {
    const hosted = {
      ...defaultConfig.providers.imageGeneration,
      enabled: true,
      mode: "black-forest-labs" as const,
    };
    const parse = (flux2Pro: Record<string, unknown>) =>
      producerConfigSchema.safeParse({
        ...defaultConfig,
        providers: { ...defaultConfig.providers, imageGeneration: { ...hosted, flux2Pro } },
      });

    expect(parse({ ...hosted.flux2Pro, endpoint: "https://api.bfl.ai/v1/other" }).success).toBe(
      false,
    );
    expect(parse({ ...hosted.flux2Pro, width: 3_000, height: 2_000 }).success).toBe(false);
    expect(
      parse({
        ...hosted.flux2Pro,
        pricing: { ...hosted.flux2Pro.pricing, maximumUsdPerImage: 0.08 },
      }).success,
    ).toBe(false);
    expect(
      producerConfigSchema.safeParse({
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          imageGeneration: { ...hosted, requiresApproval: false },
        },
      }).success,
    ).toBe(false);
  });
});
