import { approximateTokens } from "../providers/llmProvider";

export function estimateTokensForText(text: string): number {
  return approximateTokens(text);
}
