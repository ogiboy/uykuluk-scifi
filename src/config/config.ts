import { copyFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { ProducerConfig, producerConfigSchema } from "./schema.js";

const defaultConfigTemplateUrl = new URL("../../producer.config.example.json", import.meta.url);

export const defaultConfig: ProducerConfig = {
  channel: {
    name: "UykulukSciFi",
    language: "tr",
    defaultTone: "cinematic, scientifically careful, accessible Turkish narration",
  },
  prompts: { overrides: {} },
  providers: {
    llm: {
      mode: "mock",
      ollamaBaseUrl: "http://localhost:11434",
      llamaCppBaseUrl: "http://localhost:8080",
      model: "qwen3:8b",
      thinkingMode: "default",
      requestTimeoutMs: 120_000,
      maxOutputTokens: { ideas: 3000, script: 3200, productionPackage: 2000 },
    },
    tts: {
      enabled: false,
      mode: "local-piper",
      piperBinary: "piper",
      pronunciationReplacements: {},
      elevenLabs: {
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
      },
    },
    imageGeneration: { enabled: false, requiresApproval: true },
    youtube: { enabled: false, allowPrivateUpload: false, allowPublicPublish: false },
  },
  budgets: { perVideoUsd: 0.5, dailyUsd: 1, weeklyUsd: 5, requireApprovalAboveUsd: 0.01 },
  safeguards: {
    requireIdeaApproval: true,
    requireScriptApproval: true,
    requireRenderApproval: true,
    requireUploadApproval: true,
    requirePublishApproval: true,
    neverPublicPublishWithoutExplicitApproval: true,
  },
  assets: {
    brandDir: "assets/brand",
    overlayDir: "assets/overlays",
    introDir: "assets/intro",
    outroDir: "assets/outro",
  },
};

export function configPath(): string {
  return configPathAtProjectRoot(process.cwd());
}

/** Resolves the producer config path beneath a selected project root. */
export function configPathAtProjectRoot(projectRoot: string): string {
  return path.join(projectRoot, process.env.PRODUCER_CONFIG ?? "producer.config.json");
}

export async function loadConfig(): Promise<ProducerConfig> {
  return loadConfigAtProjectRoot(process.cwd());
}

/** Loads validated producer configuration from a selected Studio or CLI project root. */
export async function loadConfigAtProjectRoot(projectRoot: string): Promise<ProducerConfig> {
  const target = configPathAtProjectRoot(projectRoot);
  if (!(await pathExists(target))) {
    return defaultConfig;
  }
  const raw = await readJsonFile<unknown>(target);
  return producerConfigSchema.parse(raw);
}

export async function projectConfigExists(): Promise<boolean> {
  return pathExists(configPath());
}

export async function initProject(): Promise<string[]> {
  const created: string[] = [];
  const dirs = [
    "assets/brand",
    "assets/overlays",
    "assets/intro",
    "assets/outro",
    "prompts/local",
    "runs",
  ];
  for (const dir of dirs) {
    await ensureDir(path.join(process.cwd(), dir));
    created.push(dir);
  }
  const target = configPath();
  if (!(await pathExists(target))) {
    await copyFile(defaultConfigTemplateUrl, target);
    created.push("producer.config.json");
  }
  return created;
}
