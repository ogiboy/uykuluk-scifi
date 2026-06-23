import { ProducerConfig } from "../config/schema.js";
import { LlmProvider } from "./llmProvider.js";
import { MockProvider } from "./mockProvider.js";
import { OllamaProvider } from "./ollamaProvider.js";

export function createLlmProvider(config: ProducerConfig): LlmProvider {
  if (config.providers.llm.mode === "ollama") {
    return new OllamaProvider(config.providers.llm.ollamaBaseUrl, config.providers.llm.model);
  }
  return new MockProvider();
}
