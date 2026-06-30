import { describe, expect, it } from "vitest";
import { generateScriptContentWithBlockerRetry } from "../src/stages/scriptContentRetry";
import type {
  GenerateTextInput,
  GenerateTextResult,
  LlmProvider,
} from "../src/providers/llmProvider";

describe("script content retry", () => {
  it("retries safe contract parse failures without persisting raw provider text", async () => {
    const provider = new FlakyJsonProvider();

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
});

class FlakyJsonProvider implements LlmProvider {
  readonly prompts: string[] = [];

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    this.prompts.push(input.prompt);
    const text =
      this.prompts.length === 1
        ? "not json"
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
