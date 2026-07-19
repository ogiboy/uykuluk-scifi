import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config.js";
import { producerConfigSchema } from "../src/config/schema.js";

describe("MFLUX local visual configuration", () => {
  it("keeps a pinned Apple Silicon profile in the default configuration", () => {
    expect(defaultConfig.providers.imageGeneration.mflux).toEqual({
      runtimeVersion: "0.18.0",
      modelId: "mlx-community/flux2-klein-4b-4bit",
      modelRevision: "860e87183ceb29e39627c0612ebd66d8ea66e68c",
      quantization: "q4",
      width: 1_024,
      height: 576,
      steps: 4,
      guidance: 1,
      timeoutMs: 300_000,
      seedBase: 42_000,
    });
  });

  it("accepts MFLUX as the local image-generation mode", () => {
    const parsed = producerConfigSchema.parse({
      ...defaultConfig,
      providers: {
        ...defaultConfig.providers,
        imageGeneration: {
          ...defaultConfig.providers.imageGeneration,
          enabled: true,
          mode: "mflux-local",
        },
      },
    });

    expect(parsed.providers.imageGeneration.mode).toBe("mflux-local");
  });

  it("rejects drift from the reviewed runtime and model revision", () => {
    expect(() =>
      producerConfigSchema.parse({
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          imageGeneration: {
            ...defaultConfig.providers.imageGeneration,
            mflux: { ...defaultConfig.providers.imageGeneration.mflux, runtimeVersion: "latest" },
          },
        },
      }),
    ).toThrow();
  });
});
