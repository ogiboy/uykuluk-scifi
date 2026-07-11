import { afterEach, describe, expect, it, vi } from "vitest";
import { LlamaCppProvider } from "../src/providers/llamaCppProvider";

describe("llama.cpp provider model mismatch handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails closed when llama.cpp serves a different model than requested", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"ideas":[]}' } }],
              model: "served-model.gguf",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
    );
    const provider = new LlamaCppProvider("http://localhost:8080", "requested-model.gguf");

    await expect(provider.generateText({ prompt: "hello" })).rejects.toThrow(
      "llama.cpp served model mismatch.",
    );
  });
});
