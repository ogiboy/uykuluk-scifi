import path from "node:path";
import { copyFile } from "node:fs/promises";
import { ProducerConfig, producerConfigSchema } from "./schema";
import { ensureDir, pathExists } from "../utils/fs";
import { readJsonFile } from "../utils/json";

export const defaultConfig: ProducerConfig = {
  channel: {
    name: "UykulukSciFi",
    language: "tr",
    defaultTone: "cinematic, scientifically careful, accessible Turkish narration",
  },
  providers: {
    llm: {
      mode: "mock",
      ollamaBaseUrl: "http://localhost:11434",
      model: "qwen2.5:7b",
    },
    tts: {
      enabled: false,
      mode: "local-piper",
    },
    imageGeneration: {
      enabled: false,
      requiresApproval: true,
    },
    youtube: {
      enabled: false,
      allowPrivateUpload: false,
      allowPublicPublish: false,
    },
  },
  budgets: {
    perVideoUsd: 0.5,
    dailyUsd: 1,
    weeklyUsd: 5,
    requireApprovalAboveUsd: 0.01,
  },
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
  return path.join(process.cwd(), process.env.PRODUCER_CONFIG ?? "producer.config.json");
}

export async function loadConfig(): Promise<ProducerConfig> {
  const target = configPath();
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
    ".ai/prompts",
    ".ai/runbooks",
    ".ai/checklists",
    ".ai/reviews",
    "assets/brand",
    "assets/overlays",
    "assets/intro",
    "assets/outro",
    "runs",
  ];
  for (const dir of dirs) {
    await ensureDir(path.join(process.cwd(), dir));
    created.push(dir);
  }
  const target = configPath();
  if (!(await pathExists(target))) {
    await copyFile(path.join(process.cwd(), "producer.config.example.json"), target);
    created.push("producer.config.json");
  }
  return created;
}
