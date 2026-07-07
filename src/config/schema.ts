import { z } from "zod";

export const producerConfigSchema = z.object({
  channel: z.object({ name: z.string(), language: z.string(), defaultTone: z.string() }),
  prompts: z
    .object({
      overrides: z
        .object({
          ideas: z.string().min(1).optional(),
          script: z.string().min(1).optional(),
          productionPackage: z.string().min(1).optional(),
        })
        .default({}),
    })
    .default({ overrides: {} }),
  providers: z.object({
    llm: z.object({
      mode: z.enum(["mock", "ollama", "llama.cpp"]).default("mock"),
      ollamaBaseUrl: z.url(),
      llamaCppBaseUrl: z.url().default("http://localhost:8080"),
      model: z.string(),
      thinkingMode: z.enum(["default", "think", "no_think"]).default("default"),
      requestTimeoutMs: z.int().positive().default(120_000),
      maxOutputTokens: z
        .object({
          ideas: z.int().positive().default(3000),
          script: z.int().positive().default(3200),
          productionPackage: z.int().positive().default(2000),
        })
        .default({ ideas: 3000, script: 3200, productionPackage: 2000 }),
    }),
    tts: z.object({
      enabled: z.boolean(),
      mode: z.enum(["deterministic-local", "local-piper"]),
      piperBinary: z.string().min(1).optional(),
      piperModelPath: z.string().min(1).optional(),
      piperConfigPath: z.string().min(1).optional(),
    }),
    imageGeneration: z.object({ enabled: z.boolean(), requiresApproval: z.boolean() }),
    youtube: z.object({
      enabled: z.boolean(),
      allowPrivateUpload: z.boolean(),
      allowPublicPublish: z.boolean(),
    }),
  }),
  budgets: z.object({
    perVideoUsd: z.number().nonnegative(),
    dailyUsd: z.number().nonnegative(),
    weeklyUsd: z.number().nonnegative(),
    requireApprovalAboveUsd: z.number().nonnegative(),
  }),
  safeguards: z.object({
    requireIdeaApproval: z.boolean(),
    requireScriptApproval: z.boolean(),
    requireRenderApproval: z.boolean(),
    requireUploadApproval: z.boolean(),
    requirePublishApproval: z.boolean(),
    neverPublicPublishWithoutExplicitApproval: z.boolean(),
  }),
  assets: z.object({
    brandDir: z.string(),
    overlayDir: z.string(),
    introDir: z.string(),
    outroDir: z.string(),
  }),
});

export type ProducerConfig = z.infer<typeof producerConfigSchema>;
