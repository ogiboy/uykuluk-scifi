import { z } from "zod";

export const localModelEvalCheckSchema = z.object({
  durationMs: z.number().nonnegative().optional(),
  inputTokensApprox: z.number().nonnegative().optional(),
  message: z.string(),
  model: z.string().optional(),
  name: z.enum(["ideas-json", "script-section-json"]),
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

export const localModelCandidateEvalReportSchema = z.object({
  baseOverrides: z.array(z.string()),
  candidates: z.array(localModelEvalReportSchema),
  configSource: z.enum(["cli-overrides", "project"]),
  createdAt: z.iso.datetime(),
  durationMs: z.number().nonnegative(),
  passed: z.boolean(),
  providerMode: z.enum(["mock", "ollama", "llama.cpp"]),
});

export type LocalModelEvalCheckPersisted = z.infer<typeof localModelEvalCheckSchema>;
export type LocalModelEvalReportPersisted = z.infer<typeof localModelEvalReportSchema>;
export type LocalModelCandidateEvalReportPersisted = z.infer<
  typeof localModelCandidateEvalReportSchema
>;
