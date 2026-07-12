import { z } from "zod";

const elevenLabsOutputFormatSchema = z.enum([
  "wav_16000",
  "wav_22050",
  "wav_24000",
  "wav_32000",
  "wav_44100",
  "wav_48000",
]);

const elevenLabsTtsConfigSchema = z
  .object({
    voiceId: z.string().min(1).optional(),
    modelId: z.string().min(1).default("eleven_multilingual_v2"),
    outputFormat: elevenLabsOutputFormatSchema.default("wav_24000"),
    timeoutMs: z.int().positive().max(600_000).default(120_000),
    maxRetries: z.int().nonnegative().max(5).default(1),
    usdPerThousandCharacters: z.number().positive().default(0.1),
    voiceSettings: z
      .strictObject({
        stability: z.number().min(0).max(1).optional(),
        similarityBoost: z.number().min(0).max(1).optional(),
        style: z.number().min(0).max(1).optional(),
        useSpeakerBoost: z.boolean().optional(),
        speed: z.number().min(0.7).max(1.2).optional(),
      })
      .optional(),
  })
  .default({
    modelId: "eleven_multilingual_v2",
    outputFormat: "wav_24000",
    timeoutMs: 120_000,
    maxRetries: 1,
    usdPerThousandCharacters: 0.1,
  });

export const localProviderBaseUrlSchema = z
  .url()
  .refine(isLocalProviderBaseUrl, {
    message: "Local provider base URL must be a credential-free loopback HTTP(S) origin.",
  })
  .transform((value) => new URL(value).origin);

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
      ollamaBaseUrl: localProviderBaseUrlSchema,
      llamaCppBaseUrl: localProviderBaseUrlSchema.default("http://localhost:8080"),
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
      mode: z.enum(["deterministic-local", "local-piper", "elevenlabs"]),
      piperBinary: z.string().min(1).optional(),
      piperModelPath: z.string().min(1).optional(),
      piperConfigPath: z.string().min(1).optional(),
      pronunciationReplacements: z.record(z.string().min(1), z.string().min(1)).default({}),
      elevenLabs: elevenLabsTtsConfigSchema,
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

function isLocalProviderBaseUrl(value: string): boolean {
  const url = new URL(value);
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    (url.pathname === "" || url.pathname === "/")
  );
}
