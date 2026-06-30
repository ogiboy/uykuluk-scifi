import type { ProducerConfig } from "../config/schema.js";

export type LocalModelEvalCheckName = "ideas-json" | "script-section-json";

export function safeLocalModelEvalErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Provider evaluation failed.";
  }
  if (/^Ollama request failed \(\d+\)/u.test(error.message)) {
    return error.message.replace(/^(Ollama request failed \(\d+\)).*$/u, "$1.");
  }
  if (error.message.startsWith("Ollama provider error:")) {
    return "Ollama provider reported an error.";
  }
  if (error.message.startsWith("llama.cpp server unavailable")) {
    return "llama.cpp provider request failed.";
  }
  if (error.message.startsWith("llama.cpp request failed")) {
    return error.message;
  }
  if (error.message.startsWith("llama.cpp returned invalid JSON")) {
    return "llama.cpp provider returned invalid JSON.";
  }
  if (error.message.startsWith("llama.cpp provider error")) {
    return "llama.cpp provider reported an error.";
  }
  return error.message;
}

export function maxOutputTokensForEvalCheck(
  config: ProducerConfig,
  name: LocalModelEvalCheckName,
): number {
  const configured =
    name === "script-section-json"
      ? config.providers.llm.maxOutputTokens.script
      : config.providers.llm.maxOutputTokens.ideas;
  return Math.min(configured, 1600);
}
