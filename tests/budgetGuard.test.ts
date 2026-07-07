import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { createRun } from "../src/core/runStore";
import { costLedgerPath, readCostEvents } from "../src/costs/costLedger";
import { checkBudget } from "../src/safeguards/budgetGuard";
import { useTempProject } from "./helpers";

describe("budget guard", () => {
  useTempProject();

  it("allows zero-cost local steps and records events", async () => {
    const run = await createRun();
    const result = await checkBudget({
      run,
      config: defaultConfig,
      stage: "local",
      provider: "ollama",
      estimatedUsd: 0,
      inputTokens: 10,
      outputTokens: 20,
    });
    expect(result.allowed).toBe(true);
    expect(result.approvalRequired).toBe(false);
    expect(await readCostEvents(run.runId)).toHaveLength(1);
  });

  it("blocks when per-video budget would be exceeded", async () => {
    const run = await createRun();
    const result = await checkBudget({
      run,
      config: defaultConfig,
      stage: "paid-video",
      provider: "paid",
      estimatedUsd: 99,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons.join(" ")).toContain("Per-video budget exceeded");
  });

  it("requires approval above threshold", async () => {
    const run = await createRun();
    const result = await checkBudget({
      run,
      config: defaultConfig,
      stage: "tts",
      provider: "paid-tts",
      estimatedUsd: 0.02,
      recordCostEvent: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.approvalRequired).toBe(true);
  });

  it("checks daily and weekly local ledger totals across runs", async () => {
    const firstRun = await createRun();
    const secondRun = await createRun();
    const tightDailyConfig = {
      ...defaultConfig,
      budgets: {
        ...defaultConfig.budgets,
        perVideoUsd: 10,
        dailyUsd: 0.01,
        weeklyUsd: 10,
        requireApprovalAboveUsd: 10,
      },
    };
    await checkBudget({
      run: firstRun,
      config: tightDailyConfig,
      stage: "tts",
      provider: "paid-tts",
      estimatedUsd: 0.009,
    });
    const dailyResult = await checkBudget({
      run: secondRun,
      config: tightDailyConfig,
      stage: "tts",
      provider: "paid-tts",
      estimatedUsd: 0.009,
      recordCostEvent: false,
    });
    expect(dailyResult.allowed).toBe(false);
    expect(dailyResult.blockedReasons.join(" ")).toContain("Daily budget exceeded");

    const tightWeeklyConfig = {
      ...defaultConfig,
      budgets: {
        ...defaultConfig.budgets,
        perVideoUsd: 10,
        dailyUsd: 10,
        weeklyUsd: 0.01,
        requireApprovalAboveUsd: 10,
      },
    };
    const weeklyResult = await checkBudget({
      run: secondRun,
      config: tightWeeklyConfig,
      stage: "tts",
      provider: "paid-tts",
      estimatedUsd: 0.009,
      recordCostEvent: false,
    });
    expect(weeklyResult.allowed).toBe(false);
    expect(weeklyResult.blockedReasons.join(" ")).toContain("Weekly budget exceeded");
  });

  it("fails closed on a malformed cost ledger", async () => {
    const run = await createRun();
    const target = costLedgerPath(run.runId);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, '{"estimatedUsd":-1}\n', "utf8");

    await expect(readCostEvents(run.runId)).rejects.toThrow(/cost ledger is invalid/i);
  });
});
