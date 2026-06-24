export type GenerateTextInput = {
  system?: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | Record<string, unknown>;
};

export type GenerateTextResult = {
  text: string;
  provider: string;
  model: string;
  inputTokensApprox?: number;
  outputTokensApprox?: number;
  durationMs: number;
  raw?: unknown;
};

export interface LlmProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}

export function approximateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.4));
}
