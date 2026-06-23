import {
  GenerateTextInput,
  GenerateTextResult,
  LlmProvider,
  approximateTokens,
} from "./llmProvider.js";

type OllamaGenerateResponse = {
  response?: string;
  model?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  error?: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
};

export type OllamaDiagnostic = {
  available: boolean;
  baseUrl: string;
  model: string;
  installedModels: string[];
  message: string;
};

export class OllamaProvider implements LlmProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultModel: string,
    private readonly thinkingMode: "default" | "think" | "no_think" = "default",
  ) {}

  async diagnose(timeoutMs = 3_000): Promise<OllamaDiagnostic> {
    const baseUrl = this.baseUrl.replace(/\/$/, "");
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return {
        available: false,
        baseUrl,
        model: this.defaultModel,
        installedModels: [],
        message: `Ollama unavailable at ${baseUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    if (!response.ok) {
      return {
        available: false,
        baseUrl,
        model: this.defaultModel,
        installedModels: [],
        message: `Ollama diagnostics failed (${response.status} ${response.statusText || "HTTP error"}).`,
      };
    }
    try {
      const payload = (await response.json()) as OllamaTagsResponse;
      const installedModels = Array.from(
        new Set(
          (payload.models ?? [])
            .flatMap((model) => [model.name, model.model])
            .filter((model): model is string => Boolean(model)),
        ),
      );
      const available = installedModels.includes(this.defaultModel);
      const visibleModels = installedModels.slice(0, 20);
      return {
        available,
        baseUrl,
        model: this.defaultModel,
        installedModels,
        message: available
          ? `Ollama model ${this.defaultModel} is available at ${baseUrl}.`
          : `Configured Ollama model ${this.defaultModel} is not installed. Installed models: ${
              visibleModels.join(", ") || "none"
            }${installedModels.length > visibleModels.length ? ", …" : ""}.`,
      };
    } catch (error) {
      return {
        available: false,
        baseUrl,
        model: this.defaultModel,
        installedModels: [],
        message: `Ollama diagnostics returned invalid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const started = Date.now();
    const model = input.model ?? this.defaultModel;
    const prompt = applyThinkingMode(input.prompt, this.thinkingMode);
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
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
        raw.prompt_eval_count ?? approximateTokens(`${input.system ?? ""}\n${prompt}`),
      outputTokensApprox: raw.eval_count ?? approximateTokens(text),
      durationMs: raw.total_duration
        ? Math.round(raw.total_duration / 1_000_000)
        : Date.now() - started,
      raw,
    };
  }
}

function applyThinkingMode(prompt: string, thinkingMode: "default" | "think" | "no_think"): string {
  if (thinkingMode === "think") {
    return `/think\n${prompt}`;
  }
  if (thinkingMode === "no_think") {
    return `/no_think\n${prompt}`;
  }
  return prompt;
}
