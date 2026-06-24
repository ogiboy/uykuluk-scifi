import { z } from "zod";
import { SafeExitError } from "../core/errors.js";
import {
  normalizeIdeaBrandSpelling,
  validateIdeaListQuality,
  validateIdeaQuality,
} from "./providerIdeaQuality.js";
import { parseProviderJson } from "./providerJson.js";
import { VideoIdea } from "./types.js";

export { stripProviderThinking } from "./providerJson.js";

const videoIdeaLevelSchema = z.preprocess(normalizeIdeaLevel, z.enum(["low", "medium", "high"]));
const durationTextSchema = z
  .union([z.string().min(1), z.number()])
  .transform((value) => normalizeDurationText(value));

const providerVideoIdeaSchema = z
  .strictObject({
    id: z.unknown().optional(),
    title: z.string().min(1),
    premise: z.string().min(1),
    targetDuration: durationTextSchema.optional(),
    target_duration: durationTextSchema.optional(),
    style: z.string().min(1),
    estimatedDifficulty: videoIdeaLevelSchema.optional(),
    estimated_difficulty: videoIdeaLevelSchema.optional(),
    riskLevel: videoIdeaLevelSchema.optional(),
    risk_level: videoIdeaLevelSchema.optional(),
    fit: z.string().min(1),
  })
  .transform((idea, context) => {
    const targetDuration = idea.targetDuration ?? idea.target_duration;
    const estimatedDifficulty = idea.estimatedDifficulty ?? idea.estimated_difficulty;
    const riskLevel = idea.riskLevel ?? idea.risk_level;
    if (!targetDuration) {
      context.addIssue({
        code: "custom",
        path: ["targetDuration"],
        message: "Required",
      });
    }
    if (!estimatedDifficulty) {
      context.addIssue({
        code: "custom",
        path: ["estimatedDifficulty"],
        message: "Required",
      });
    }
    if (!riskLevel) {
      context.addIssue({
        code: "custom",
        path: ["riskLevel"],
        message: "Required",
      });
    }
    if (!targetDuration || !estimatedDifficulty || !riskLevel) {
      return z.NEVER;
    }
    const normalizedIdea = normalizeIdeaBrandSpelling({
      title: idea.title,
      premise: idea.premise,
      targetDuration,
      style: idea.style,
      estimatedDifficulty,
      riskLevel,
      fit: idea.fit,
    });
    const qualityIssue = validateIdeaQuality(normalizedIdea);
    if (qualityIssue) {
      context.addIssue({
        code: "custom",
        path: qualityIssue.path,
        message: qualityIssue.message,
      });
      return z.NEVER;
    }
    return normalizedIdea;
  });

const packageYoutubeSchema = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)),
});

const productionPackageProviderPayloadSchema = z
  .strictObject({
    popupCards: z.array(z.string().min(1)).optional(),
    popup_cards: z.array(z.string().min(1)).optional(),
    lowerThirds: z.array(z.string().min(1)).optional(),
    lower_thirds: z.array(z.string().min(1)).optional(),
    youtube: packageYoutubeSchema,
  })
  .transform((payload, context) => {
    const popupCards = payload.popupCards ?? payload.popup_cards;
    const lowerThirds = payload.lowerThirds ?? payload.lower_thirds;
    if (!popupCards) {
      context.addIssue({
        code: "custom",
        path: ["popupCards"],
        message: "Required",
      });
    }
    if (!lowerThirds) {
      context.addIssue({
        code: "custom",
        path: ["lowerThirds"],
        message: "Required",
      });
    }
    if (!popupCards || !lowerThirds) {
      return z.NEVER;
    }
    return {
      popupCards,
      lowerThirds,
      youtube: payload.youtube,
    };
  });

const productionPackageRuntimePayloadSchema = z.strictObject({
  popupCards: z.array(z.string().min(1)),
  lowerThirds: z.array(z.string().min(1)),
  youtube: z.strictObject({
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string().min(1)),
  }),
});

const ideasArraySchema = z.array(providerVideoIdeaSchema).min(1);

const ideasObjectSchema = z.strictObject({ ideas: ideasArraySchema });

export type PackageProviderPayload = z.infer<typeof productionPackageRuntimePayloadSchema>;

export function parseIdeasProviderPayload(text: string): VideoIdea[] {
  const payload = parseProviderJson(text, "ideas");
  const result = Array.isArray(payload)
    ? ideasArraySchema.safeParse(payload)
    : ideasObjectSchema.safeParse(payload);
  if (!result.success) {
    throw invalidProviderPayload("ideas", result.error);
  }
  const ideas = Array.isArray(result.data) ? result.data : result.data.ideas;
  const distinctIssue = validateIdeaListQuality(ideas);
  if (distinctIssue) {
    throw new SafeExitError(`Invalid ideas provider response: ${distinctIssue}`);
  }
  return ideas.slice(0, 10).map((idea, index) => ({
    id: `idea_${String(index + 1).padStart(3, "0")}`,
    ...idea,
  }));
}

export function parseProductionPackageProviderPayload(text: string): PackageProviderPayload {
  const payload = parseProviderJson(text, "production package");
  const result = productionPackageProviderPayloadSchema.safeParse(payload);
  if (!result.success) {
    throw invalidProviderPayload("production package", result.error);
  }
  return productionPackageRuntimePayloadSchema.parse(result.data);
}

function invalidProviderPayload(label: string, error: z.ZodError): SafeExitError {
  const summary = error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
  return new SafeExitError(`Invalid ${label} provider response: ${summary}`);
}

function normalizeDurationText(value: string | number): string {
  if (typeof value === "number") {
    return `${value} dakika`;
  }
  const trimmed = value.trim();
  const minutesMatch = /^(\d+(?:[.,]\d+)?)\s*(?:minutes?|mins?|min)\.?$/i.exec(trimmed);
  if (minutesMatch) {
    return `${minutesMatch[1]} dakika`;
  }
  return trimmed;
}

function normalizeIdeaLevel(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLocaleLowerCase("tr");
  const localizedLevels: Record<string, "low" | "medium" | "high"> = {
    düşük: "low",
    dusuk: "low",
    orta: "medium",
    yüksek: "high",
    yuksek: "high",
  };
  return localizedLevels[normalized] ?? normalized;
}
