import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { createRun, listRuns, loadRun } from "../src/core/runStore";
import { appendCostEvent } from "../src/costs/costLedger";
import { defaultStagePricing } from "../src/costs/pricing";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { pathExists } from "../src/utils/fs";
import { nowIso } from "../src/utils/time";
import { useTempProject } from "./helpers";

describe("stage budget preflight", () => {
  useTempProject();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks idea generation before artifacts when daily budget is already exceeded", async () => {
    const previousRun = await createRun();
    await appendCostEvent({
      runId: previousRun.runId,
      stage: "seed",
      provider: "test",
      estimatedUsd: 2,
      createdAt: nowIso(),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await useOllamaConfig();

    await expect(runIdeas()).rejects.toThrow(/budget/i);

    expect(fetchMock).not.toHaveBeenCalled();
    const blockedRun = (await listRuns()).find((run) => run.runId !== previousRun.runId);
    expect(blockedRun).toBeDefined();
    expect(blockedRun?.state).toBe("NEW");
    expect(await pathExists(artifactPath(blockedRun!.runId, "ideas.json"))).toBe(false);
    expect(
      (await readLedger(blockedRun!.runId)).some(
        (event) => event.type === "GUARD_BLOCKED" && event.stage === "ideas",
      ),
    ).toBe(true);
  });

  it("uses the stage pricing estimate before calling the provider", async () => {
    const previousEstimate = defaultStagePricing.ideas.estimatedUsd;
    defaultStagePricing.ideas.estimatedUsd = 2;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await useOllamaConfig();

    try {
      await expect(runIdeas()).rejects.toThrow(/budget/i);
    } finally {
      defaultStagePricing.ideas.estimatedUsd = previousEstimate;
    }

    expect(fetchMock).not.toHaveBeenCalled();
    const blockedRun = (await listRuns())[0];
    expect(blockedRun.state).toBe("NEW");
    expect(await pathExists(artifactPath(blockedRun.runId, "ideas.json"))).toBe(false);
  });

  it("blocks script generation before artifacts when the run budget is exceeded", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await appendCostEvent({
      runId,
      stage: "seed",
      provider: "test",
      estimatedUsd: 1,
      createdAt: nowIso(),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await useOllamaConfig();

    await expect(generateScript(runId)).rejects.toThrow(/budget/i);

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await loadRun(runId)).state).toBe("IDEA_APPROVED");
    expect(await pathExists(artifactPath(runId, "script.md"))).toBe(false);
  });

  it("blocks package generation before provider calls when the weekly budget is exceeded", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await reviewScript(runId);
    await approveScript(runId, { acknowledgeWarnings: true });
    await appendCostEvent({
      runId,
      stage: "seed",
      provider: "test",
      estimatedUsd: 1,
      createdAt: nowIso(),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await useOllamaConfig({
      perVideoUsd: 10,
      dailyUsd: 10,
      weeklyUsd: 0.5,
      requireApprovalAboveUsd: 10,
    });

    await expect(generateProductionPackage(runId)).rejects.toThrow(/budget/i);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      (await readLedger(runId)).some(
        (event) =>
          event.type === "GUARD_BLOCKED" &&
          event.stage === "package" &&
          JSON.stringify(event.data).includes("Weekly budget exceeded"),
      ),
    ).toBe(true);
    expect((await loadRun(runId)).state).toBe("SCRIPT_APPROVED");
    expect(await pathExists(artifactPath(runId, "production/production_package.md"))).toBe(false);
  });
});

async function useOllamaConfig(budgets = defaultConfig.budgets): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          llm: {
            ...defaultConfig.providers.llm,
            mode: "ollama",
          },
        },
        budgets,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
