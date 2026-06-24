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

describe("script generation failure diagnostics", () => {
  useTempProject();

  it("persists safe diagnostics when provider JSON cannot be parsed", async () => {
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
              model: "mock-invalid-script-json",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await expect(generateScript(runId)).rejects.toThrow(
      /Invalid script section draft provider response/,
    );

    expect((await loadRun(runId)).state).toBe("IDEA_APPROVED");
    expect(await pathExists(artifactPath(runId, "script.md"))).toBe(false);
    const diagnostics = await readJsonFile<{
      runId: string;
      stage: string;
      state: string;
      providerMode: string;
      model: string;
      message: string;
    }>(artifactPath(runId, "diagnostics/script_generation_failure.json"));
    expect(diagnostics).toMatchObject({
      runId,
      stage: "script",
      state: "IDEA_APPROVED",
      providerMode: "mock",
      model: "mock-invalid-script-json",
      message: expect.stringContaining("Invalid script section draft provider response"),
    });
  });
});
