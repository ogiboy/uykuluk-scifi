import { z } from "zod";

export const mfluxLocalConfigSchema = z
  .strictObject({
    runtimeVersion: z.literal("0.18.0").default("0.18.0"),
    modelId: z
      .literal("mlx-community/flux2-klein-4b-4bit")
      .default("mlx-community/flux2-klein-4b-4bit"),
    modelRevision: z
      .literal("860e87183ceb29e39627c0612ebd66d8ea66e68c")
      .default("860e87183ceb29e39627c0612ebd66d8ea66e68c"),
    quantization: z.literal("q4").default("q4"),
    width: z.literal(1_024).default(1_024),
    height: z.literal(576).default(576),
    steps: z.literal(4).default(4),
    guidance: z.literal(1).default(1),
    timeoutMs: z.int().min(30_000).max(900_000).default(300_000),
    seedBase: z.int().nonnegative().max(2_147_483_647).default(42_000),
  })
  .default({
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

const flux2ProConfigSchema = z
  .strictObject({
    model: z.literal("flux-2-pro").default("flux-2-pro"),
    endpoint: z
      .literal("https://api.bfl.ai/v1/flux-2-pro")
      .default("https://api.bfl.ai/v1/flux-2-pro"),
    width: z.int().min(64).max(8_192).default(1_920),
    height: z.int().min(64).max(8_192).default(1_080),
    outputFormat: z.enum(["jpeg", "png"]).default("jpeg"),
    safetyTolerance: z.int().min(0).max(5).default(2),
    timeoutMs: z.int().min(1_000).max(600_000).default(300_000),
    pollIntervalMs: z.int().min(250).max(10_000).default(1_000),
    maxPollAttempts: z.int().positive().max(2_400).default(300),
    pricing: z
      .strictObject({
        snapshotId: z.string().min(1).max(128).default("bfl-flux-2-pro-2026-07-15"),
        usdPerMegapixel: z.number().positive().max(100).default(0.03),
        usdPerCredit: z.literal(0.01).default(0.01),
        maximumUsdPerImage: z.number().positive().max(100).default(0.09),
      })
      .default({
        snapshotId: "bfl-flux-2-pro-2026-07-15",
        usdPerMegapixel: 0.03,
        usdPerCredit: 0.01,
        maximumUsdPerImage: 0.09,
      }),
  })
  .default({
    model: "flux-2-pro",
    endpoint: "https://api.bfl.ai/v1/flux-2-pro",
    width: 1_920,
    height: 1_080,
    outputFormat: "jpeg",
    safetyTolerance: 2,
    timeoutMs: 300_000,
    pollIntervalMs: 1_000,
    maxPollAttempts: 300,
    pricing: {
      snapshotId: "bfl-flux-2-pro-2026-07-15",
      usdPerMegapixel: 0.03,
      usdPerCredit: 0.01,
      maximumUsdPerImage: 0.09,
    },
  })
  .superRefine((config, context) => {
    if (config.width * config.height > 4_000_000) {
      context.addIssue({
        code: "custom",
        message: "FLUX.2 Pro images may not exceed 4 megapixels.",
        path: ["width"],
      });
    }
    if (config.pollIntervalMs * config.maxPollAttempts > config.timeoutMs) {
      context.addIssue({
        code: "custom",
        message: "FLUX.2 Pro polling bounds must fit within timeoutMs.",
        path: ["maxPollAttempts"],
      });
    }
    const snapshotEstimate =
      Math.ceil((config.width * config.height) / 1_000_000) * config.pricing.usdPerMegapixel;
    if (config.pricing.maximumUsdPerImage < snapshotEstimate) {
      context.addIssue({
        code: "custom",
        message: "FLUX.2 Pro maximumUsdPerImage must cover the configured megapixel price.",
        path: ["pricing", "maximumUsdPerImage"],
      });
    }
  });

export const imageGenerationConfigSchema = z
  .strictObject({
    enabled: z.boolean(),
    requiresApproval: z.boolean(),
    mode: z.enum(["static-manual", "mflux-local", "black-forest-labs"]).default("static-manual"),
    mflux: mfluxLocalConfigSchema,
    flux2Pro: flux2ProConfigSchema,
  })
  .superRefine((config, context) => {
    if (config.enabled && config.mode === "black-forest-labs" && !config.requiresApproval) {
      context.addIssue({
        code: "custom",
        message: "Enabled Black Forest Labs generation requires exact cost approval.",
        path: ["requiresApproval"],
      });
    }
  });
