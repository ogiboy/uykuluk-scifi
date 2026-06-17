export type VideoIdea = {
  id: string;
  title: string;
  premise: string;
  targetDuration: string;
  style: string;
  estimatedDifficulty: "low" | "medium" | "high" | string;
  riskLevel: "low" | "medium" | "high" | string;
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
};

export type ProductionScene = {
  index: number;
  narration: string;
  visualPrompt: string;
  durationSeconds: number;
};
