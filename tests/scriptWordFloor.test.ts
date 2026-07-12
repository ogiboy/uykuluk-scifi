import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { generateScript } from "../src/stages/script";
import {
  assertLongFormWordFloor,
  longFormWordFloor,
} from "../src/stages/script/scriptContinuation";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

describe("script word-floor enforcement", () => {
  useTempProject();

  it("accepts a complete draft at the 8-12 minute spoken-narration floor", () => {
    expect(longFormWordFloor).toBe(1100);
    expect(() => assertLongFormWordFloor("kelime ".repeat(longFormWordFloor))).not.toThrow();
    expect(() => assertLongFormWordFloor("kelime ".repeat(longFormWordFloor - 1))).toThrow(
      /below the long-form floor/,
    );
  });

  it("fails closed when bounded continuations still miss the long-form floor", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          providers: {
            ...defaultConfig.providers,
            llm: { ...defaultConfig.providers.llm, model: "mock-underfilled-continuations" },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await expect(generateScript(runId)).rejects.toThrow(/below the long-form floor/);

    expect((await loadRun(runId)).state).toBe("IDEA_APPROVED");
    expect(await pathExists(artifactPath(runId, "script.md"))).toBe(false);
    expect(await pathExists(artifactPath(runId, "script.sections.json"))).toBe(false);
    const diagnostics = await readJsonFile<{
      failureKind: string;
      message: string;
      nextAction: string;
      requiredWordCount: number;
      wordCount: number;
      generation: {
        receiptCount: number;
        providerCallCount: number;
        acceptedWordCount: number;
        passes: Array<{ pass: string; receiptCount: number; acceptedWordCount: number }>;
      };
    }>(artifactPath(runId, "diagnostics/script_generation_failure.json"));
    expect(diagnostics.message).toMatch(
      new RegExp(
        `Invalid assembled script provider response: remains below the long-form floor after bounded continuation passes \\(\\d+/${longFormWordFloor} words\\)`,
      ),
    );
    expect(diagnostics).toMatchObject({
      failureKind: "below_long_form_floor",
      requiredWordCount: longFormWordFloor,
      nextAction: expect.stringContaining(`pnpm producer script --run ${runId}`),
    });
    expect(diagnostics.wordCount).toBeLessThan(longFormWordFloor);
    expect(diagnostics.generation.receiptCount).toBeGreaterThan(0);
    expect(diagnostics.generation.providerCallCount).toBeGreaterThanOrEqual(
      diagnostics.generation.receiptCount,
    );
    expect(diagnostics.generation.acceptedWordCount).toBeGreaterThan(0);
    expect(diagnostics.generation.passes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pass: "draft", receiptCount: 4 }),
        expect.objectContaining({ pass: "continuation", receiptCount: 3 }),
      ]),
    );
    expect(diagnostics.message).not.toContain("kısa bir ölçüm notuyla");
  });
});
