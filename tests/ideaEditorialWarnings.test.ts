import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { loadRun } from "../src/core/runStore";
import { runIdeas } from "../src/stages/ideas";
import { useTempProject } from "./helpers";

describe("idea editorial warnings", () => {
  useTempProject();

  it("persists repetitive fit copy as review evidence without weakening hard idea guards", async () => {
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          providers: {
            ...defaultConfig.providers,
            llm: { ...defaultConfig.providers.llm, model: "mock-idea-editorial-warning" },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const { runId } = await runIdeas();
    const artifact = JSON.parse(await readFile(artifactPath(runId, "ideas.json"), "utf8")) as {
      qualityWarnings: Array<{ code: string; message: string }>;
    };
    const run = await loadRun(runId);

    expect(artifact.qualityWarnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "repeated_fit_frame" })]),
    );
    expect(run.state).toBe("IDEAS_GENERATED");
    expect(run.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Fit explanations reuse")]),
    );
    expect(await readLedger(runId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "WARNING",
          stage: "ideas",
          message: expect.stringContaining("editorial copy warnings"),
        }),
      ]),
    );
  });
});
