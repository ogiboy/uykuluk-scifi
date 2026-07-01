import { afterEach, describe, expect, it, vi } from "vitest";
import { LlamaCppProvider } from "../src/providers/llamaCppProvider";

describe("llama.cpp provider URL redaction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redacts configured URL credentials and query strings from diagnostics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED fixture-password")));
    const provider = new LlamaCppProvider(
      "http://fixture-user:fixture-password@localhost:8080/private?sample=fixture-value",
      "local-model.gguf",
    );

    const diagnostic = await provider.diagnose();

    expect(diagnostic.baseUrl).toBe("http://localhost:8080/redacted-path");
    expect(diagnostic.message).toContain("http://localhost:8080/redacted-path");
    expect(diagnostic.message).not.toContain("fixture-password");
    expect(diagnostic.message).not.toContain("fixture-user");
    expect(diagnostic.message).not.toContain("/private");
    await expect(provider.generateText({ prompt: "hello" })).rejects.toThrow(
      "llama.cpp server unavailable at http://localhost:8080/redacted-path (transport error).",
    );
  });
});
