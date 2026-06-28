import { ProducerConfig } from "../config/schema.js";
import { LlamaCppProvider } from "./llamaCppProvider.js";
import { LlmProvider } from "./llmProvider.js";
import { MockProvider } from "./mockProvider.js";
import { OllamaProvider } from "./ollamaProvider.js";

export function createLlmProvider(config: ProducerConfig): LlmProvider {
  if (config.providers.llm.mode === "ollama") {
    return new OllamaProvider(
      config.providers.llm.ollamaBaseUrl,
      config.providers.llm.model,
      config.providers.llm.thinkingMode,
      config.providers.llm.requestTimeoutMs,
    );
  }
  if (config.providers.llm.mode === "llama.cpp") {
    return new LlamaCppProvider(
      config.providers.llm.llamaCppBaseUrl,
      config.providers.llm.model,
      config.providers.llm.requestTimeoutMs,
    );
  }
  return new MockProvider();
}
