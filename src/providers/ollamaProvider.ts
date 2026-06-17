import {
  GenerateTextInput,
  GenerateTextResult,
  LlmProvider,
  approximateTokens,
} from "./llmProvider";

type OllamaGenerateResponse = {
  response?: string;
  model?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  error?: string;
};

export class OllamaProvider implements LlmProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultModel: string,
  ) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const started = Date.now();
    const model = input.model ?? this.defaultModel;
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        system: input.system,
        options: {
          temperature: input.temperature,
          num_predict: input.maxTokens,
        },
        stream: false,
      }),
    }).catch((error: unknown) => {
      throw new Error(`Ollama unavailable at ${this.baseUrl}: ${(error as Error).message}`);
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${body}`);
    }

    const raw = (await response.json()) as OllamaGenerateResponse;
    if (raw.error) {
      throw new Error(`Ollama provider error: ${raw.error}`);
    }
    const text = raw.response ?? "";
    return {
      text,
      provider: "ollama",
      model: raw.model ?? model,
      inputTokensApprox:
        raw.prompt_eval_count ?? approximateTokens(`${input.system ?? ""}\n${input.prompt}`),
      outputTokensApprox: raw.eval_count ?? approximateTokens(text),
      durationMs: raw.total_duration
        ? Math.round(raw.total_duration / 1_000_000)
        : Date.now() - started,
      raw,
    };
  }
}
