import {
  GenerateTextInput,
  GenerateTextResult,
  LlmProvider,
  approximateTokens,
} from "./llmProvider.js";

type LlamaCppModelListResponse = {
  data?: Array<{
    id?: string;
    object?: string;
  }>;
};

type LlamaCppChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
  error?: unknown;
  model?: string;
  usage?: {
    completion_tokens?: number;
    prompt_tokens?: number;
  };
};

export type LlamaCppDiagnostic = {
  available: boolean;
  baseUrl: string;
  model: string;
  servedModels: string[];
  message: string;
};

/**
 * Local llama.cpp server provider using the OpenAI-compatible chat completions API.
 *
 * This adapter is intentionally local-first: it does not hold credentials, does not call hosted
 * OpenAI APIs, and reports bounded diagnostics without persisting response bodies.
 */
export class LlamaCppProvider implements LlmProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultModel: string,
    private readonly requestTimeoutMs = 120_000,
  ) {}

  async diagnose(timeoutMs = 3_000): Promise<LlamaCppDiagnostic> {
    const baseUrl = withoutTrailingSlash(this.baseUrl);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return {
        available: false,
        baseUrl,
        model: this.defaultModel,
        servedModels: [],
        message: `llama.cpp server unavailable at ${baseUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    if (!response.ok) {
      return {
        available: false,
        baseUrl,
        model: this.defaultModel,
        servedModels: [],
        message: `llama.cpp diagnostics failed (${response.status} ${response.statusText || "HTTP error"}).`,
      };
    }
    try {
      const payload = (await response.json()) as LlamaCppModelListResponse;
      const servedModels = Array.from(
        new Set((payload.data ?? []).map((model) => model.id).filter(isString)),
      );
      const available = servedModels.includes(this.defaultModel);
      return {
        available,
        baseUrl,
        model: this.defaultModel,
        servedModels,
        message: available
          ? `llama.cpp model ${this.defaultModel} is available at ${baseUrl}.`
          : servedModelsMessage(this.defaultModel, servedModels),
      };
    } catch (error) {
      return {
        available: false,
        baseUrl,
        model: this.defaultModel,
        servedModels: [],
        message: `llama.cpp diagnostics returned invalid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const started = Date.now();
    const model = input.model ?? this.defaultModel;
    const baseUrl = withoutTrailingSlash(this.baseUrl);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
        body: JSON.stringify({
          model,
          messages: providerMessages(input),
          response_format: responseFormat(input.responseFormat),
          temperature: input.temperature,
          max_tokens: input.maxTokens,
          stream: false,
        }),
      });
    } catch (error) {
      throw new Error(
        `llama.cpp server unavailable at ${baseUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new Error(
        `llama.cpp request failed (${response.status} ${response.statusText || "HTTP error"}).`,
      );
    }

    let raw: LlamaCppChatCompletionResponse;
    try {
      raw = (await response.json()) as LlamaCppChatCompletionResponse;
    } catch (error) {
      throw new Error(
        `llama.cpp returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    if (raw.error) {
      throw new Error("llama.cpp provider error.");
    }
    const text = raw.choices?.[0]?.message?.content ?? raw.choices?.[0]?.text ?? "";
    return {
      text,
      provider: "llama.cpp",
      model: raw.model ?? model,
      inputTokensApprox:
        raw.usage?.prompt_tokens ?? approximateTokens(`${input.system ?? ""}\n${input.prompt}`),
      outputTokensApprox: raw.usage?.completion_tokens ?? approximateTokens(text),
      durationMs: Date.now() - started,
      raw,
    };
  }
}

function providerMessages(
  input: GenerateTextInput,
): Array<{ role: "system" | "user"; content: string }> {
  return [
    ...(input.system ? [{ role: "system" as const, content: input.system }] : []),
    { role: "user", content: input.prompt },
  ];
}

function responseFormat(value: GenerateTextInput["responseFormat"]):
  | {
      json_schema?: { name: string; schema: Record<string, unknown>; strict: boolean };
      type: string;
    }
  | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "json") {
    return { type: "json_object" };
  }
  return {
    type: "json_schema",
    json_schema: {
      name: "uykuluk_response",
      schema: value,
      strict: true,
    },
  };
}

function servedModelsMessage(defaultModel: string, servedModels: string[]): string {
  const visibleModels = servedModels.slice(0, 20);
  const modelList = visibleModels.join(", ") || "none";
  const overflowSuffix = servedModels.length > visibleModels.length ? ", …" : "";
  return `Configured llama.cpp model ${defaultModel} is not served. Served models: ${modelList}${overflowSuffix}.`;
}

function withoutTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
