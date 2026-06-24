import { mkdir, utimes, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { reservationLockPath, withCostReservationLock } from "../src/costs/costReservationLock";
import {
  costReservationLedgerPath,
  readCostReservationEvents,
  readCostReservationSummaries,
} from "../src/costs/costReservationStore";
import { releaseCostReservation, reserveApprovedCost } from "../src/costs/costReservationService";
import { defaultStagePricing } from "../src/costs/pricing";
import { readLedger } from "../src/core/ledger";
import { loadRun } from "../src/core/runStore";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { estimateCost } from "../src/stages/estimate";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";
import { paidAdapterIdentity } from "./paidRun";

describe("cost reservation", () => {
  useTempProject();

  const originalTtsPrice = defaultStagePricing.tts.estimatedUsd;
  const originalTtsProvider = defaultStagePricing.tts.provider;

  afterEach(() => {
    defaultStagePricing.tts.estimatedUsd = originalTtsPrice;
    defaultStagePricing.tts.provider = originalTtsProvider;
  });

  it("atomically consumes one approved quote line once", async () => {
    const runId = await prepareReadyPaidRun({ estimatedUsd: 0.02 });

    const results = await Promise.allSettled([
      reserveApprovedCost({
        runId,
        stage: "tts",
        operationId: "tts-attempt-a",
        adapterIdentity: paidAdapterIdentity,
      }),
      reserveApprovedCost({
        runId,
        stage: "tts",
        operationId: "tts-attempt-b",
        adapterIdentity: paidAdapterIdentity,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const summaries = await readCostReservationSummaries(runId);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      runId,
      stage: "tts",
      provider: "future-paid-tts",
      maxUsdMicros: 20_000,
      status: "RESERVED",
    });
    const reservedEvents = (await readLedger(runId)).filter(
      (event) => event.type === "COST_RESERVED",
    );
    expect(reservedEvents).toHaveLength(1);
    expect(reservedEvents[0]).toMatchObject({
      runId,
      stage: "tts",
      data: { reservationId: summaries[0].reservationId },
    });
  });

  it("returns the same reservation for an idempotent operation retry", async () => {
    const runId = await prepareReadyPaidRun({ estimatedUsd: 0.02 });

    const first = await reserveApprovedCost({
      runId,
      stage: "tts",
      operationId: "tts-idempotent",
      adapterIdentity: paidAdapterIdentity,
    });
    const second = await reserveApprovedCost({
      runId,
      stage: "tts",
      operationId: "tts-idempotent",
      adapterIdentity: paidAdapterIdentity,
    });

    expect(second.reservationId).toBe(first.reservationId);
    expect(
      (await readCostReservationEvents(runId)).filter((event) => event.type === "RESERVED"),
    ).toHaveLength(1);
  });

  it("does not reuse a released quote line", async () => {
    const runId = await prepareReadyPaidRun({ estimatedUsd: 0.02 });
    const reservation = await reserveApprovedCost({
      runId,
      stage: "tts",
      operationId: "tts-release",
      adapterIdentity: paidAdapterIdentity,
    });

    await releaseCostReservation({
      runId,
      reservationId: reservation.reservationId,
      reason: "Provider request was not sent.",
    });

    await expect(
      reserveApprovedCost({
        runId,
        stage: "tts",
        operationId: "tts-retry",
        adapterIdentity: paidAdapterIdentity,
      }),
    ).rejects.toThrow(/consumed|new quote|approval/i);
    expect((await readCostReservationSummaries(runId))[0].status).toBe("RELEASED");
  });

  it("prevents two runs from overbooking the shared daily budget", async () => {
    const budgets = {
      ...defaultConfig.budgets,
      perVideoUsd: 1,
      dailyUsd: 0.03,
      weeklyUsd: 1,
      requireApprovalAboveUsd: 0.001,
    };
    const firstRunId = await prepareReadyPaidRun({ estimatedUsd: 0.02, budgets });
    const secondRunId = await prepareReadyPaidRun({ estimatedUsd: 0.02, budgets });

    const results = await Promise.allSettled([
      reserveApprovedCost({
        runId: firstRunId,
        stage: "tts",
        operationId: "daily-a",
        adapterIdentity: paidAdapterIdentity,
      }),
      reserveApprovedCost({
        runId: secondRunId,
        stage: "tts",
        operationId: "daily-b",
        adapterIdentity: paidAdapterIdentity,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const totalReservations =
      (await readCostReservationSummaries(firstRunId)).length +
      (await readCostReservationSummaries(secondRunId)).length;
    expect(totalReservations).toBe(1);
  });

  it("reclaims a stale project reservation lock", async () => {
    const target = reservationLockPath();
    await mkdir(target, { recursive: true });
    await writeFile(`${target}/owner.json`, '{"token":"stale"}\n', "utf8");
    const old = new Date(Date.now() - 60_000);
    await utimes(target, old, old);

    const result = await withCostReservationLock(async () => "acquired", {
      staleMs: 10,
      timeoutMs: 500,
      retryMs: 5,
    });

    expect(result).toBe("acquired");
  });

  it("does not reclaim a live owner after the stale threshold elapses", async () => {
    let firstActive = false;
    let overlapped = false;
    const options = { staleMs: 20, timeoutMs: 500, retryMs: 5 };

    const first = withCostReservationLock(async () => {
      firstActive = true;
      await new Promise((resolve) => setTimeout(resolve, 80));
      firstActive = false;
    }, options);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const second = withCostReservationLock(async () => {
      overlapped = firstActive;
    }, options);

    await Promise.all([first, second]);
    expect(overlapped).toBe(false);
  });

  it("does not retry task errors that resemble lock contention", async () => {
    let calls = 0;

    await expect(
      withCostReservationLock(
        async () => {
          calls += 1;
          const error = new Error("task collision") as NodeJS.ErrnoException;
          error.code = "EEXIST";
          throw error;
        },
        { timeoutMs: 30, retryMs: 5 },
      ),
    ).rejects.toThrow("task collision");
    expect(calls).toBe(1);
  });

  it("fails closed on a malformed reservation ledger", async () => {
    const runId = await prepareReadyPaidRun({ estimatedUsd: 0.02 });
    await writeFile(costReservationLedgerPath(runId), '{"type":"RESERVED"}\n', "utf8");

    await expect(readCostReservationEvents(runId)).rejects.toThrow(
      /reservation ledger is invalid/i,
    );
  });
});

async function prepareReadyPaidRun(input: {
  estimatedUsd: number;
  budgets?: typeof defaultConfig.budgets;
}): Promise<string> {
  defaultStagePricing.tts.estimatedUsd = input.estimatedUsd;
  defaultStagePricing.tts.provider = "future-paid-tts";
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: { ...defaultConfig.providers.tts, enabled: true },
        },
        budgets: input.budgets ?? defaultConfig.budgets,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  await approvePaidGenerationCost(runId);
  await runReadiness(runId);
  expect((await loadRun(runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
  return runId;
}
