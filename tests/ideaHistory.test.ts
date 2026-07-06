import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { listRuns } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import {
  historicalIdeaTitleIssue,
  ideaHistoryPromptBlock,
  readIdeaHistory,
} from "../src/stages/ideaHistory";
import { runIdeas } from "../src/stages/ideas";
import type { VideoIdea } from "../src/stages/types";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

describe("idea history originality guard", () => {
  useTempProject();

  it("builds compact title-only prompt context from runtime run artifacts", async () => {
    const { ideas, runId } = await runIdeas();

    await approveIdea(runId, ideas[0].id);

    const history = await readIdeaHistory();
    const approvedEntry = history.find(
      (entry) => entry.runId === runId && entry.ideaId === ideas[0].id,
    );
    const promptBlock = ideaHistoryPromptBlock(history);

    expect(approvedEntry).toMatchObject({
      runId,
      ideaId: ideas[0].id,
      status: "approved",
      title: ideas[0].title,
    });
    expect(promptBlock).toContain("Recent UykulukSciFi Idea History");
    expect(promptBlock).toContain(ideas[0].title);
    expect(promptBlock).not.toContain(ideas[0].premise);
    expect(
      historicalIdeaTitleIssue(
        [{ ...ideas[0], title: `${ideas[0].title}!` } satisfies VideoIdea],
        history,
      ),
    ).toContain("Repeats previously approved idea");
  });

  it("hard-blocks generated but unapproved titles from being offered again", async () => {
    await useMockModel("mock-repeat-history-ideas");
    const { runId } = await runIdeas();

    await expect(runIdeas()).rejects.toThrow(/previously generated idea/i);

    const failedRun = (await listRuns()).find((run) => run.runId !== runId);

    expect(failedRun).toBeDefined();
    expect(failedRun?.state).toBe("NEW");
    expect(await pathExists(artifactPath(failedRun!.runId, "ideas.json"))).toBe(false);
    expect(
      await pathExists(artifactPath(failedRun!.runId, "diagnostics/ideas_generation_failure.json")),
    ).toBe(true);
  });

  it("fails closed instead of persisting a repeated approved idea title", async () => {
    await useMockModel("mock-repeat-history-ideas");
    const { ideas, runId } = await runIdeas();
    await approveIdea(runId, ideas[0].id);

    await expect(runIdeas()).rejects.toThrow(/previously approved idea/i);

    const failedRun = (await listRuns()).find((run) => run.runId !== runId);

    expect(failedRun).toBeDefined();
    expect(failedRun?.state).toBe("NEW");
    expect(await pathExists(artifactPath(failedRun!.runId, "ideas.json"))).toBe(false);
    expect(
      await pathExists(artifactPath(failedRun!.runId, "diagnostics/ideas_generation_failure.json")),
    ).toBe(true);
    expect(
      (await readLedger(failedRun!.runId)).some(
        (event) =>
          event.type === "ERROR" &&
          event.stage === "ideas" &&
          /previously approved idea/i.test(event.message),
      ),
    ).toBe(true);
  });

  it("records title-history evidence without storing script-sized context", async () => {
    const { ideas, runId } = await runIdeas();
    const artifact = await readJsonFile<{
      history: {
        approvedTitlesConsidered: number;
        generatedTitlesConsidered: number;
        promptTitles: {
          approvedTitles: string[];
          generatedTitles: string[];
        };
        source: string;
      };
    }>(artifactPath(runId, "ideas.json"));

    expect(artifact.history).toEqual({
      source: "runs/ideas.json",
      approvedTitlesConsidered: 0,
      generatedTitlesConsidered: 0,
      promptTitles: {
        approvedTitles: [],
        generatedTitles: [],
      },
    });
    expect(JSON.stringify(artifact.history)).not.toContain(ideas[0].premise);
  });
});

async function useMockModel(model: string): Promise<void> {
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
}
