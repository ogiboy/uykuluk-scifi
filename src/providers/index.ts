import { ProducerConfig } from "../config/schema";
import { LlmProvider } from "./llmProvider";
import { MockProvider } from "./mockProvider";
import { OllamaProvider } from "./ollamaProvider";

export function createLlmProvider(config: ProducerConfig): LlmProvider {
  if (config.providers.llm.mode === "ollama") {
    return new OllamaProvider(config.providers.llm.ollamaBaseUrl, config.providers.llm.model);
  }
  return new MockProvider();
}
