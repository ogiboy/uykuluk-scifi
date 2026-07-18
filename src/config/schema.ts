import { z } from "zod";
import {
  promptProfileIdSchema,
  promptProfiles,
  promptProfileSchema,
} from "../prompts/profiles/promptProfileStore.js";
import { imageGenerationConfigSchema } from "./imageGenerationSchema.js";

const elevenLabsOutputFormatSchema = z.enum([
  "wav_16000",
  "wav_22050",
  "wav_24000",
  "wav_32000",
  "wav_44100",
  "wav_48000",
]);

const editorialConfigSchema = z
  .strictObject({
    activeProfileId: promptProfileIdSchema.default("sci-fi"),
    profiles: z
      .array(promptProfileSchema)
      .min(1)
      .max(32)
      .default([...promptProfiles]),
  })
  .default({ activeProfileId: "sci-fi", profiles: [...promptProfiles] })
  .superRefine((editorial, context) => {
    const ids = editorial.profiles.map((profile) => profile.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Prompt profile ids must be unique.",
        path: ["profiles"],
      });
    }
    if (!ids.includes(editorial.activeProfileId)) {
      context.addIssue({
        code: "custom",
        message: "The active prompt profile must exist in editorial.profiles.",
        path: ["activeProfileId"],
      });
    }
  });

const elevenLabsTtsConfigSchema = z
  .object({
    voiceId: z.string().min(1).optional(),
    modelId: z.string().min(1).default("eleven_v3"),
    languageCode: z.literal("tr").default("tr"),
    applyTextNormalization: z.enum(["auto", "on", "off"]).default("auto"),
    seed: z.int().nonnegative().max(4_294_967_295).default(42),
    maxCharactersPerRequest: z.int().min(250).max(5_000).default(4_500),
    outputFormat: elevenLabsOutputFormatSchema.default("wav_24000"),
    timeoutMs: z.int().positive().max(600_000).default(300_000),
    maxRetries: z.literal(0).default(0),
    usdPerThousandCharacters: z.number().positive().default(0.1),
    voiceSettings: z
      .strictObject({
        stability: z.number().min(0).max(1).optional(),
        similarityBoost: z.number().min(0).max(1).optional(),
        style: z.number().min(0).max(1).optional(),
        useSpeakerBoost: z.boolean().optional(),
        speed: z.number().min(0.7).max(1.2).optional(),
      })
      .default({ stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1 }),
  })
  .default({
    modelId: "eleven_v3",
    languageCode: "tr",
    applyTextNormalization: "auto",
    seed: 42,
    maxCharactersPerRequest: 4_500,
    outputFormat: "wav_24000",
    timeoutMs: 300_000,
    maxRetries: 0,
    usdPerThousandCharacters: 0.1,
    voiceSettings: { stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1 },
  })
  .superRefine((config, context) => {
    if (config.modelId === "eleven_v3" && config.voiceSettings.useSpeakerBoost !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Eleven v3 does not support Speaker Boost.",
        path: ["voiceSettings", "useSpeakerBoost"],
      });
    }
  });

export const localProviderBaseUrlSchema = z
  .url()
  .refine(isLocalProviderBaseUrl, {
    message: "Local provider base URL must be a credential-free loopback HTTP(S) origin.",
  })
  .transform((value) => new URL(value).origin);

export const producerConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  settingsRevision: z.int().nonnegative().default(0),
  studio: z
    .strictObject({
      port: z.int().min(1_024).max(65_535).default(3_000),
      locale: z.enum(["tr", "en"]).default("tr"),
      theme: z.enum(["dark", "light", "system"]).default("system"),
    })
    .default({ port: 3_000, locale: "tr", theme: "system" }),
  channel: z.object({ name: z.string(), language: z.string(), defaultTone: z.string() }),
  editorial: editorialConfigSchema,
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
    imageGeneration: imageGenerationConfigSchema,
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
