import { afterEach, describe, expect, it, vi } from "vitest";
import { LlamaCppProvider } from "../src/providers/llamaCppProvider";

describe("llama.cpp provider model identity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts the server's leading current-directory marker during diagnostics", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: [{ id: "./models/llm/model.gguf", object: "model" }] }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
    );
    const provider = new LlamaCppProvider("http://localhost:8080", "models/llm/model.gguf");

    await expect(provider.diagnose()).resolves.toMatchObject({
      available: true,
      kind: "available",
      model: "models/llm/model.gguf",
      servedModels: ["./models/llm/model.gguf"],
    });
  });

  it("reports the configured model after accepting an equivalent served identifier", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"ideas":[]}' } }],
              model: "./models/llm/model.gguf",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
    );
    const provider = new LlamaCppProvider("http://localhost:8080", "models/llm/model.gguf");

    await expect(provider.generateText({ prompt: "hello" })).resolves.toMatchObject({
      model: "models/llm/model.gguf",
      provider: "llama.cpp",
      text: '{"ideas":[]}',
    });
  });
});
