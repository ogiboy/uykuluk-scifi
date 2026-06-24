import { afterEach, describe, expect, it, vi } from "vitest";
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
});
