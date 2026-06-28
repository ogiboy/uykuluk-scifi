import { afterEach, describe, expect, it, vi } from "vitest";
import { LlamaCppProvider } from "../src/providers/llamaCppProvider";
import { MockProvider } from "../src/providers/mockProvider";
import { OllamaProvider } from "../src/providers/ollamaProvider";

describe("LLM providers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns deterministic mock output with usage metadata", async () => {
    const provider = new MockProvider();
    const input = { prompt: "IDEAS_JSON\nGenerate ideas.", model: "mock-test" };

    const first = await provider.generateText(input);
    const second = await provider.generateText(input);

    expect(second.text).toBe(first.text);
    expect(first).toMatchObject({
      provider: "mock",
      model: "mock-test",
      inputTokensApprox: expect.any(Number),
      outputTokensApprox: expect.any(Number),
      durationMs: expect.any(Number),
    });
  });

  it("reports a clear diagnostic when Ollama is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const provider = new OllamaProvider("http://localhost:11434", "qwen3:8b");

    await expect(provider.generateText({ prompt: "hello" })).rejects.toThrow(
      "Ollama unavailable at http://localhost:11434: ECONNREFUSED",
    );
  });

  it("records Ollama model, token usage, and duration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            response: "yanit",
            model: "qwen3:8b",
            prompt_eval_count: 12,
            eval_count: 7,
            total_duration: 2_000_000,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const provider = new OllamaProvider("http://localhost:11434/", "fallback");

    await expect(provider.generateText({ prompt: "hello" })).resolves.toMatchObject({
      text: "yanit",
      provider: "ollama",
      model: "qwen3:8b",
      inputTokensApprox: 12,
      outputTokensApprox: 7,
      durationMs: 2,
    });
  });

  it("prefixes Ollama prompts when a thinking mode is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: "yanit", model: "qwen3:8b" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OllamaProvider("http://localhost:11434/", "qwen3:8b", "no_think");

    await provider.generateText({ prompt: "SCRIPT_MARKDOWN\nMerhaba" });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { prompt: string };
    expect(body.prompt).toBe("/no_think\nSCRIPT_MARKDOWN\nMerhaba");
  });

  it("passes max token caps through to Ollama num_predict", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: "yanit", model: "qwen3:8b" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OllamaProvider("http://localhost:11434/", "qwen3:8b");

    await provider.generateText({ prompt: "hello", maxTokens: 1234 });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      options: { num_predict?: number };
    };
    expect(body.options.num_predict).toBe(1234);
  });

  it("passes an abort signal to Ollama generation requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: "yanit", model: "qwen3:8b" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OllamaProvider("http://localhost:11434/", "qwen3:8b", "default", 7_500);

    await provider.generateText({ prompt: "hello" });

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("passes structured response format through to Ollama", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: '{"text":"tamam"}', model: "qwen3:8b" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OllamaProvider("http://localhost:11434/", "qwen3:8b");

    await provider.generateText({
      prompt: "JSON",
      responseFormat: { type: "object", properties: { text: { type: "string" } } },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      format?: unknown;
    };
    expect(body.format).toEqual({ type: "object", properties: { text: { type: "string" } } });
  });

  it("records llama.cpp model, token usage, and OpenAI-compatible chat payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ideas":[]}' } }],
          model: "Mistral-7B-Instruct-v0.3.Q4_K_M.gguf",
          usage: { prompt_tokens: 10, completion_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new LlamaCppProvider(
      "http://localhost:8080/",
      "Mistral-7B-Instruct-v0.3.Q4_K_M.gguf",
    );

    await expect(
      provider.generateText({
        maxTokens: 256,
        prompt: "IDEAS_JSON",
        responseFormat: "json",
        system: "Return JSON.",
        temperature: 0.2,
      }),
    ).resolves.toMatchObject({
      text: '{"ideas":[]}',
      provider: "llama.cpp",
      model: "Mistral-7B-Instruct-v0.3.Q4_K_M.gguf",
      inputTokensApprox: 10,
      outputTokensApprox: 4,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/v1/chat/completions",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      max_tokens?: number;
      messages?: Array<{ content: string; role: string }>;
      response_format?: { type: string };
      temperature?: number;
    };
    expect(body).toMatchObject({
      max_tokens: 256,
      messages: [
        { role: "system", content: "Return JSON." },
        { role: "user", content: "IDEAS_JSON" },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
  });

  it("passes JSON schema response format through to llama.cpp", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"text":"tamam"}' } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new LlamaCppProvider("http://localhost:8080", "local-model.gguf");

    await provider.generateText({
      prompt: "SCRIPT_SECTION_JSON",
      responseFormat: { type: "object", properties: { text: { type: "string" } } },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      response_format?: unknown;
    };
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "uykuluk_response",
        schema: { type: "object", properties: { text: { type: "string" } } },
        strict: true,
      },
    });
  });

  it("reports clear llama.cpp diagnostics without persisting response bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("local-secret-response", {
          status: 500,
          statusText: "Internal Server Error",
        }),
      ),
    );
    const provider = new LlamaCppProvider("http://localhost:8080", "local-model.gguf");

    await expect(provider.diagnose()).resolves.toMatchObject({
      available: false,
      message: "llama.cpp diagnostics failed (500 Internal Server Error).",
    });
  });

  it("blocks when the configured llama.cpp model is not served", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: "other-model.gguf" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const provider = new LlamaCppProvider("http://localhost:8080", "local-model.gguf");

    await expect(provider.diagnose()).resolves.toMatchObject({
      available: false,
      message:
        "Configured llama.cpp model local-model.gguf is not served. Served models: other-model.gguf.",
    });
  });
});
