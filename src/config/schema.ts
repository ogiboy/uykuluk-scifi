import { z } from "zod";

export const producerConfigSchema = z.object({
  channel: z.object({
    name: z.string(),
    language: z.string(),
    defaultTone: z.string(),
  }),
  providers: z.object({
    llm: z.object({
      mode: z.enum(["mock", "ollama"]).default("mock"),
      ollamaBaseUrl: z.url(),
      model: z.string(),
    }),
    tts: z.object({
      enabled: z.boolean(),
      mode: z.string(),
    }),
    imageGeneration: z.object({
      enabled: z.boolean(),
      requiresApproval: z.boolean(),
    }),
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
