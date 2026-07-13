import type { CostBindingSummary } from "./costBindingSummary.js";

export type StagePricing = {
  stage: string;
  provider: string;
  model?: string;
  bindingDigest?: string;
  bindingSummary?: CostBindingSummary;
  estimatedUsd: number;
};

export const defaultStagePricing: Record<string, StagePricing> = {
  ideas: { stage: "ideas", provider: "mock-or-local-llm", estimatedUsd: 0 },
  script: { stage: "script", provider: "mock-or-local-llm", estimatedUsd: 0 },
  review: { stage: "review", provider: "local-heuristic", estimatedUsd: 0 },
  package: { stage: "package", provider: "mock-or-local-llm", estimatedUsd: 0 },
  tts: { stage: "tts", provider: "disabled", estimatedUsd: 0 },
  imageGeneration: { stage: "imageGeneration", provider: "disabled", estimatedUsd: 0 },
  videoGeneration: { stage: "videoGeneration", provider: "disabled", estimatedUsd: 0 },
  render: { stage: "render", provider: "local-compute", estimatedUsd: 0 },
  upload: { stage: "upload", provider: "youtube-disabled", estimatedUsd: 0 },
};
