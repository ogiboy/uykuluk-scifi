import { z } from "zod";

export const localModelEvalCheckSchema = z.object({
  durationMs: z.number().nonnegative().optional(),
  inputTokensApprox: z.number().nonnegative().optional(),
  message: z.string(),
  model: z.string().optional(),
  name: z.enum(["ideas-json", "script-section-json", "script-quality-guard"]),
  outputHash: z.string().optional(),
  outputTokensApprox: z.number().nonnegative().optional(),
  promptHash: z.string().optional(),
  provider: z.string().optional(),
  status: z.enum(["pass", "block"]),
});

export const localModelEvalReportSchema = z.object({
  appliedOverrides: z.array(z.string()),
  checks: z.array(localModelEvalCheckSchema),
  configSource: z.enum(["cli-overrides", "project"]),
  configuredModel: z.string(),
  createdAt: z.iso.datetime(),
  durationMs: z.number().nonnegative(),
  passed: z.boolean(),
  providerMode: z.enum(["mock", "ollama", "llama.cpp"]),
});

export const localModelCandidateRecommendationSchema = z.object({
  blockedChecks: z.int().nonnegative(),
  configuredModel: z.string(),
  durationMs: z.number().nonnegative(),
  passedChecks: z.int().nonnegative(),
});

export const localModelCandidateOperatorGuidanceSchema = z.object({
  decision: z.enum(["candidate-ready", "candidate-ready-with-blockers", "try-more-candidates"]),
  message: z.string(),
  nextCommand: z.string(),
});

export const localModelCandidateEvalReportSchema = z.object({
  baseOverrides: z.array(z.string()),
  candidates: z.array(localModelEvalReportSchema),
  configSource: z.enum(["cli-overrides", "project"]),
  createdAt: z.iso.datetime(),
  durationMs: z.number().nonnegative(),
  passed: z.boolean(),
  providerMode: z.enum(["mock", "ollama", "llama.cpp"]),
  operatorGuidance: localModelCandidateOperatorGuidanceSchema.optional(),
  recommendedCandidate: localModelCandidateRecommendationSchema.nullable().optional(),
});

export type LocalModelEvalCheckPersisted = z.infer<typeof localModelEvalCheckSchema>;
export type LocalModelEvalReportPersisted = z.infer<typeof localModelEvalReportSchema>;
export type LocalModelCandidateRecommendationPersisted = z.infer<
  typeof localModelCandidateRecommendationSchema
>;
export type LocalModelCandidateOperatorGuidancePersisted = z.infer<
  typeof localModelCandidateOperatorGuidanceSchema
>;
export type LocalModelCandidateEvalReportPersisted = z.infer<
  typeof localModelCandidateEvalReportSchema
>;
