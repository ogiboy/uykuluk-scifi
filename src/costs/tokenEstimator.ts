import { approximateTokens } from "../providers/llmProvider.js";

export function estimateTokensForText(text: string): number {
  return approximateTokens(text);
}
