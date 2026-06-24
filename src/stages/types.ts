import type { PromptProvenance } from "../prompts/provenance.js";

export type VideoIdeaLevel = "low" | "medium" | "high";

export type VideoIdea = {
  id: string;
  title: string;
  premise: string;
  targetDuration: string;
  style: string;
  estimatedDifficulty: VideoIdeaLevel;
  riskLevel: VideoIdeaLevel;
  fit: string;
};

export type ScriptMeta = {
  estimatedDuration: string;
  wordCount: number;
  tone: string;
  claimsRequiringFactCheck: string[];
  possibleVisualBeats: string[];
  provider: string;
  model: string;
  inputTokensApprox?: number;
  outputTokensApprox?: number;
  durationMs: number;
  sectionCount: number;
  prompt: PromptProvenance;
};

export type ProductionScene = {
  index: number;
  narration: string;
  visualPrompt: string;
  durationSeconds: number;
};
