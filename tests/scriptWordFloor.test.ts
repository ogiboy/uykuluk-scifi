import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { generateScript } from "../src/stages/script";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

describe("script word-floor enforcement", () => {
  useTempProject();

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
            llm: {
              ...defaultConfig.providers.llm,
              model: "mock-underfilled-continuations",
            },
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
    const diagnostics = await readJsonFile<{ message: string }>(
      artifactPath(runId, "diagnostics/script_generation_failure.json"),
    );
    expect(diagnostics.message).toMatch(
      /Invalid assembled script provider response: remains below the long-form floor after bounded continuation passes \(\d+\/1200 words\)/,
    );
    expect(diagnostics.message).not.toContain("kısa bir ölçüm notuyla");
  });
});
