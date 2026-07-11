import { afterEach, describe, expect, it, vi } from "vitest";
import { LlamaCppProvider } from "../src/providers/llamaCppProvider";

describe("llama.cpp provider diagnostic privacy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redacts credentials, paths, queries, and fragments from transport diagnostics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const provider = new LlamaCppProvider(
      "http://local-user:local-pass@localhost:8080/private?token=local-test#fragment",
      "local-model.gguf",
    );

    const diagnostic = await provider.diagnose();

    expect(diagnostic).toMatchObject({
      available: false,
      baseUrl: "http://localhost:8080/redacted-path",
      message:
        "llama.cpp server unavailable at http://localhost:8080/redacted-path (transport error).",
    });
    expect(JSON.stringify(diagnostic)).not.toContain("local-user");
    expect(JSON.stringify(diagnostic)).not.toContain("local-pass");
    expect(JSON.stringify(diagnostic)).not.toContain("local-test");
    expect(JSON.stringify(diagnostic)).not.toContain("private");
    expect(JSON.stringify(diagnostic)).not.toContain("fragment");
  });
});
