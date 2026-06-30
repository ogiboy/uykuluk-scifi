import { describe, expect, it } from "vitest";
import { generateScriptContentWithBlockerRetry } from "../src/stages/scriptContentRetry";
import type {
  GenerateTextInput,
  GenerateTextResult,
  LlmProvider,
} from "../src/providers/llmProvider";

describe("script content retry", () => {
  it("retries safe contract parse failures without persisting raw provider text", async () => {
    const provider = new FlakyJsonProvider("not json");

    const result = await generateScriptContentWithBlockerRetry({
      parse: (text) => {
        const payload = JSON.parse(text) as { text: string };
        return payload.text;
      },
      prompt: "Return JSON.",
      provider,
      request: {
        model: "mock-flaky-json",
        temperature: 0.1,
        maxTokens: 200,
        responseFormat: { type: "object" },
      },
      source: "script section draft provider response for hook",
      textOf: (text) => text,
    });

    expect(result.parsed).toBe("Anlatıcı: Geçerli ve sakin bir Türkçe cümle kurulur.");
    expect(result.blockerRetry).toMatchObject({
      attemptCount: 2,
      blockers: expect.stringContaining("contract_parse_failure"),
      rejectedAttempt: {
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        model: "mock-flaky-json",
        provider: "mock",
      },
    });
    expect(result.blockerRetry?.blockers).not.toContain("not json");
    expect(provider.prompts[1]).toContain("SCRIPT_CONTENT_RETRY");
  });

  it("does not echo unknown parser exception text into retries", async () => {
    const provider = new FlakyJsonProvider(JSON.stringify({ text: "throw-secret" }));

    const result = await generateScriptContentWithBlockerRetry({
      parse: (text) => {
        const payload = JSON.parse(text) as { text: string };
        if (payload.text === "throw-secret") {
          throw new Error("raw model output: local-secret");
        }
        return payload.text;
      },
      prompt: "Return JSON.",
      provider,
      request: {
        model: "mock-flaky-json",
        temperature: 0.1,
        maxTokens: 200,
        responseFormat: { type: "object" },
      },
      source: "script section draft provider response for hook",
      textOf: (text) => text,
    });

    expect(result.parsed).toBe("Anlatıcı: Geçerli ve sakin bir Türkçe cümle kurulur.");
    expect(result.blockerRetry?.blockers).toContain(
      "provider response did not match the requested JSON contract",
    );
    expect(result.blockerRetry?.blockers).not.toContain("local-secret");
    expect(provider.prompts[1]).not.toContain("local-secret");
  });
});

class FlakyJsonProvider implements LlmProvider {
  readonly prompts: string[] = [];

  constructor(private readonly firstText: string) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    this.prompts.push(input.prompt);
    const text =
      this.prompts.length === 1
        ? this.firstText
        : JSON.stringify({
            text: "Anlatıcı: Geçerli ve sakin bir Türkçe cümle kurulur.",
          });

    return {
      durationMs: 1,
      inputTokensApprox: 1,
      model: input.model ?? "mock-flaky-json",
      outputTokensApprox: 1,
      provider: "mock",
      text,
    };
  }
}
