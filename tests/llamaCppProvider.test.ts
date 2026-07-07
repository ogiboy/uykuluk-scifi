import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config/config";
import { createLlmProvider } from "../src/providers";
import { LlamaCppProvider } from "../src/providers/llamaCppProvider";

describe("llama.cpp provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates llama.cpp providers from config", () => {
    const provider = createLlmProvider({
      ...defaultConfig,
      providers: {
        ...defaultConfig.providers,
        llm: {
          ...defaultConfig.providers.llm,
          mode: "llama.cpp",
          llamaCppBaseUrl: "http://localhost:8080",
          model: "local-model.gguf",
        },
      },
    });

    expect(provider).toBeInstanceOf(LlamaCppProvider);
  });

  it("records model, token usage, and OpenAI-compatible chat payloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
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

  it("passes JSON schema response format through", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
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

  it("uses legacy text choices when chat message content is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ choices: [{ text: "legacy completion" }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
    );
    const provider = new LlamaCppProvider("http://localhost:8080", "local-model.gguf");

    await expect(provider.generateText({ prompt: "hello" })).resolves.toMatchObject({
      text: "legacy completion",
      provider: "llama.cpp",
      model: "local-model.gguf",
      inputTokensApprox: expect.any(Number),
      outputTokensApprox: expect.any(Number),
    });
  });

  it("reports generation fetch failures clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const provider = new LlamaCppProvider("http://localhost:8080/", "local-model.gguf");

    await expect(provider.generateText({ prompt: "hello" })).rejects.toThrow(
      "llama.cpp server unavailable at http://localhost:8080 (transport error).",
    );
  });

  it("reports generation HTTP failures without response bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("local-secret-response", {
            status: 500,
            statusText: "Internal Server Error",
          }),
        ),
    );
    const provider = new LlamaCppProvider("http://localhost:8080", "local-model.gguf");

    await expect(provider.generateText({ prompt: "hello" })).rejects.toThrow(
      "llama.cpp request failed (500 Internal Server Error).",
    );
  });

  it("reports invalid generation JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("{", { status: 200, headers: { "content-type": "application/json" } }),
        ),
    );
    const provider = new LlamaCppProvider("http://localhost:8080", "local-model.gguf");

    await expect(provider.generateText({ prompt: "hello" })).rejects.toThrow(
      "llama.cpp returned invalid JSON:",
    );
  });

  it("reports provider error payloads without echoing provider content", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { message: "local-secret-response" } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
    );
    const provider = new LlamaCppProvider("http://localhost:8080", "local-model.gguf");

    await expect(provider.generateText({ prompt: "hello" })).rejects.toThrow(
      "llama.cpp provider error.",
    );
  });

  it("reports clear diagnostics without persisting response bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
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

  it("reports invalid diagnostic JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("{", { status: 200, headers: { "content-type": "application/json" } }),
        ),
    );
    const provider = new LlamaCppProvider("http://localhost:8080", "local-model.gguf");

    await expect(provider.diagnose()).resolves.toMatchObject({
      available: false,
      message: expect.stringContaining("llama.cpp diagnostics returned invalid JSON:"),
    });
  });

  it("blocks when the configured model is not served", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
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
