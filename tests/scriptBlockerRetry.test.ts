import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";

const repeatedSentence =
  "Bu kaybolma, bilim insanlarının yeni teoriler geliştirmesini zorunlu kılıyor";

describe("script blocker retry", () => {
  useTempProject();

  it("retries one rejected expansion chunk with safe blocker evidence", async () => {
    const sections = await generateScriptSectionsWithModel(
      "mock-repeated-script-expansion-then-repair",
    );
    const retriedReceipt = sections.sections.find(
      (section) => section.id === "hook" && section.pass === "expansion" && section.chunk === 1,
    );

    expect(sections.providerCallCount).toBe(17);
    expect(retriedReceipt?.blockerRetry).toMatchObject({
      attemptCount: 2,
      blockers: expect.stringContaining("repeated_sentence_loop"),
      rejectedAttempt: {
        promptHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        outputTokensApprox: expect.any(Number),
      },
      rejectedAttempts: [
        expect.objectContaining({
          promptHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          outputTokensApprox: expect.any(Number),
        }),
      ],
    });
    expect(JSON.stringify(sections)).not.toContain(repeatedSentence);
  });

  it("uses the strict retry prompt when repairing rejected expansion chunks", async () => {
    const sections = await generateScriptSectionsWithModel(
      "mock-repeated-script-expansion-requires-strict-retry",
    );
    const retriedReceipt = sections.sections.find(
      (section) => section.id === "hook" && section.pass === "expansion" && section.chunk === 1,
    );

    expect(sections.providerCallCount).toBe(17);
    expect(retriedReceipt?.blockerRetry?.blockers).toContain("repeated_sentence_loop");
  });

  it("uses a second bounded strict retry before failing closed on repeated local output", async () => {
    const sections = await generateScriptSectionsWithModel(
      "mock-repeated-script-expansion-requires-second-retry",
    );
    const retriedReceipt = sections.sections.find(
      (section) => section.id === "hook" && section.pass === "expansion" && section.chunk === 1,
    );

    expect(sections.providerCallCount).toBe(18);
    expect(retriedReceipt?.blockerRetry).toMatchObject({
      attemptCount: 3,
      blockers: expect.stringContaining("attempt 2: content_blockers: repeated_sentence_loop"),
      rejectedAttempts: [
        expect.objectContaining({ contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
        expect.objectContaining({ contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
      ],
    });
    expect(retriedReceipt?.blockerRetry?.rejectedAttempts).toHaveLength(2);
    expect(JSON.stringify(sections)).not.toContain(repeatedSentence);
  });

  it("retries one rejected continuation chunk with safe blocker evidence", async () => {
    const sections = await generateScriptSectionsWithModel(
      "mock-repeated-continuation-then-repair",
    );
    const retriedContinuation = sections.sections.find(
      (section) => section.pass === "continuation" && section.blockerRetry,
    );

    expect(sections.providerCallCount).toBe(19);
    expect(retriedContinuation?.blockerRetry).toMatchObject({
      attemptCount: 2,
      blockers: expect.stringContaining("repeated_sentence_loop"),
      rejectedAttempt: {
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      rejectedAttempts: [
        expect.objectContaining({
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      ],
    });
    expect(JSON.stringify(sections)).not.toContain(repeatedSentence);
  });
});

async function generateScriptSectionsWithModel(model: string): Promise<ScriptSectionsArtifact> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          llm: {
            ...defaultConfig.providers.llm,
            model,
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  return JSON.parse(
    await readFile(artifactPath(runId, "script.sections.json"), "utf8"),
  ) as ScriptSectionsArtifact;
}

type ScriptSectionsArtifact = {
  providerCallCount: number;
  sections: Array<{
    blockerRetry?: {
      attemptCount: number;
      blockers: string;
      rejectedAttempt: {
        contentHash: string;
        outputTokensApprox?: number;
        promptHash?: string;
      };
      rejectedAttempts?: Array<{
        contentHash: string;
        outputTokensApprox?: number;
        promptHash?: string;
      }>;
    };
    chunk?: number;
    id: string;
    pass: "draft" | "expansion" | "continuation";
  }>;
};
