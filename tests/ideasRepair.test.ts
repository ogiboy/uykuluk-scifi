import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { listRuns, loadRun } from "../src/core/runStore";
import * as ideasStage from "../src/stages/ideas";
import { runIdeas } from "../src/stages/ideas";
import type { VideoIdea } from "../src/stages/types";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

type IdeasArtifact = {
  ideas: VideoIdea[];
  prompt: {
    artifact: string;
    hash: string;
    key: string;
    source?: string;
  };
  repair: {
    attempted: boolean;
    attempts: number;
    prompt?: {
      artifact: string;
      hash: string;
      key: string;
      source?: string;
    };
    validationErrors: string[];
  };
};

describe("idea provider retry and repair", () => {
  useTempProject();

  it("anchors the repair prompt to strict anti-repetition constraints", () => {
    const renderIdeaRepairPrompt = (
      ideasStage as {
        renderIdeaRepairPrompt?: (
          originalPrompt: string,
          validationError: string | string[],
        ) => string;
      }
    ).renderIdeaRepairPrompt;

    expect(typeof renderIdeaRepairPrompt).toBe("function");
    if (!renderIdeaRepairPrompt) {
      return;
    }

    const prompt = renderIdeaRepairPrompt(
      "IDEAS_JSON\nbase planner contract",
      'Invalid ideas provider response: ideas.3.title: Repeated title motif "yıldız" weakens idea diversity.',
    );

    expect(prompt).toContain("IDEA_REPAIR_JSON");
    expect(prompt).toContain("Do not reuse or revise the rejected draft");
    expect(prompt).toContain("Forbidden high-collision title roots in repaired titles");
    expect(prompt).toContain(
      "`Uyku`, `Yıldız`, `Yildiz`, `Karanlık`, `Karanlik`, `Mesaj`, `Gezegen`",
    );
    expect(prompt).toContain(
      "If validation feedback names a repeated motif, that motif is forbidden",
    );
    expect(prompt).toContain("Forced diversity slots");
    expect(prompt).toContain("Return the eight ideas in this exact slot order");
    expect(prompt).toContain("Buzaltı Haritası");
    expect(prompt).toContain("Paslı Android Mezarlığı");
    expect(prompt).toContain("Nötrino Gecikmesi");
    expect(prompt).toContain("Sonda Günlüğü");
    expect(prompt).toContain(
      "Do not repeat four-word sentence frames across three or more `fit` explanations",
    );
    expect(prompt).toContain("Do not repeat generic fit boilerplate");
    expect(prompt).toContain("Do not begin more than one premise with the same first three words");
    expect(prompt).toContain("Do not use `Belki bu` in more than one premise");
    expect(prompt).toContain("Do not repeat generic unknown-species boilerplate");
    expect(prompt).toContain("Do not repeat weak action boilerplate");
    expect(prompt).toContain("buzaltı okyanusu anomalisi");
    expect(prompt).toContain("insan-sonrası arkeoloji");
    expect(prompt).toContain("no five-word phrase may appear in three or more premises");
    expect(prompt).toContain("no repeated fit frame");
    expect(prompt).toContain("no repeated unknown-species boilerplate");
    expect(prompt).toContain("no repeated weak action boilerplate");
  });

  it("retries one invalid local-model idea slate with validation feedback", async () => {
    await useMockModel("mock-invalid-ideas-then-repair");

    const { runId, ideas } = await runIdeas();

    const artifact = JSON.parse(
      await readFile(artifactPath(runId, "ideas.json"), "utf8"),
    ) as IdeasArtifact;
    const ledger = await readLedger(runId);

    expect(ideas).toHaveLength(8);
    expect(artifact.ideas).toHaveLength(8);
    expect(artifact.prompt).toEqual({
      key: "ideas",
      artifact: "ideas.json",
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      source: "prompts/defaults/planner-task.md",
    });
    expect(artifact.repair).toEqual({
      attempted: true,
      attempts: 1,
      prompt: {
        key: "ideas",
        artifact: "ideas.json",
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        source: "src/stages/ideaRepairPrompt.ts",
      },
      validationErrors: [expect.stringMatching(/Invalid ideas provider response/i)],
    });
    expect(artifact.repair.prompt?.hash).not.toBe(artifact.prompt.hash);
    expect(JSON.stringify(artifact)).not.toContain("Tekrar Eden Gezegen");
    expect((await loadRun(runId)).state).toBe("IDEAS_GENERATED");
    expect(
      ledger.some(
        (event) =>
          event.type === "WARNING" &&
          event.stage === "ideas" &&
          /retrying repair attempt 1\/2/i.test(event.message),
      ),
    ).toBe(true);
  });

  it("uses a second bounded repair attempt when the first repair is still invalid", async () => {
    await useMockModel("mock-invalid-ideas-two-repairs");

    const { runId, ideas } = await runIdeas();

    const artifact = JSON.parse(
      await readFile(artifactPath(runId, "ideas.json"), "utf8"),
    ) as IdeasArtifact;
    const retryWarnings = (await readLedger(runId)).filter(
      (event) =>
        event.type === "WARNING" && event.stage === "ideas" && /retrying/i.test(event.message),
    );

    expect(ideas).toHaveLength(8);
    expect(artifact.repair).toEqual({
      attempted: true,
      attempts: 2,
      prompt: {
        key: "ideas",
        artifact: "ideas.json",
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        source: "src/stages/ideaRepairPrompt.ts",
      },
      validationErrors: [
        expect.stringMatching(/Ideas must be meaningfully distinct/i),
        expect.stringMatching(/repeated premise frame/i),
      ],
    });
    expect(retryWarnings).toHaveLength(2);
  });

  it("fails closed without artifacts when the repair attempt remains invalid", async () => {
    await useMockModel("mock-invalid-ideas-always");

    await expect(runIdeas()).rejects.toThrow(/after repair attempt/i);

    const [run] = await listRuns();
    expect(run.state).toBe("NEW");
    expect(run.artifacts).toContain("diagnostics/ideas_generation_failure.json");
    expect(await pathExists(artifactPath(run.runId, "ideas.json"))).toBe(false);
    expect(await pathExists(artifactPath(run.runId, "ideas.md"))).toBe(false);
    const diagnostics = await readJsonFile<{
      message: string;
      model: string;
      providerMode: string;
      stage: string;
      state: string;
    }>(artifactPath(run.runId, "diagnostics/ideas_generation_failure.json"));
    expect(diagnostics).toMatchObject({
      stage: "ideas",
      state: "NEW",
      providerMode: "mock",
      model: "mock-invalid-ideas-always",
      message: expect.stringContaining("Invalid ideas provider response after repair attempt"),
    });
    expect(JSON.stringify(diagnostics)).not.toContain("Tekrar Eden Gezegen");
    expect(
      (await readLedger(run.runId)).some(
        (event) =>
          event.type === "ERROR" &&
          event.stage === "ideas" &&
          /after repair attempt/i.test(event.message),
      ),
    ).toBe(true);
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
