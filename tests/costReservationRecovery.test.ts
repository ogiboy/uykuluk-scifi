import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { readCostEvents } from "../src/costs/costLedger";
import {
  markCostReservationUncertain,
  reconcileCostReservation,
  reserveApprovedCost,
  settleCostReservation,
} from "../src/costs/costReservationService";
import {
  appendCostReservationEvent,
  readCostReservationSummaries,
} from "../src/costs/costReservationStore";
import { defaultStagePricing } from "../src/costs/pricing";
import { loadRun } from "../src/core/runStore";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { readJsonFile } from "../src/utils/json";
import { nowIso } from "../src/utils/time";
import { useTempProject } from "./helpers";

describe("cost reservation recovery", () => {
  useTempProject();

  const originalTtsPrice = defaultStagePricing.tts.estimatedUsd;
  const originalTtsProvider = defaultStagePricing.tts.provider;

  afterEach(() => {
    defaultStagePricing.tts.estimatedUsd = originalTtsPrice;
    defaultStagePricing.tts.provider = originalTtsProvider;
  });

  it("settles idempotently and records one reservation-linked cost event", async () => {
    const runId = await prepareReadyPaidRun(0.02);
    const reservation = await reserveApprovedCost({
      runId,
      stage: "tts",
      operationId: "settle-idempotent",
    });

    const first = await settleCostReservation({
      runId,
      reservationId: reservation.reservationId,
      actualUsdMicros: 18_000,
      durationMs: 50,
    });
    const second = await settleCostReservation({
      runId,
      reservationId: reservation.reservationId,
      actualUsdMicros: 18_000,
      durationMs: 50,
    });

    expect(first.status).toBe("SETTLED");
    expect(second.status).toBe("SETTLED");
    const linked = (await readCostEvents(runId)).filter(
      (event) => event.reservationId === reservation.reservationId,
    );
    expect(linked).toHaveLength(1);
    expect(linked[0].actualUsd).toBe(0.018);
    await generateEvidenceBundle(runId);
    const evidence = await readJsonFile<{
      costReservations: Array<{ reservationId: string; status: string }>;
    }>(artifactPath(runId, "evidence_bundle.json"));
    expect(evidence.costReservations).toContainEqual(
      expect.objectContaining({
        reservationId: reservation.reservationId,
        status: "SETTLED",
      }),
    );
  });

  it("recovers a settlement that stopped after the pending journal event", async () => {
    const runId = await prepareReadyPaidRun(0.02);
    const reservation = await reserveApprovedCost({
      runId,
      stage: "tts",
      operationId: "settle-recovery",
    });
    await appendCostReservationEvent({
      eventId: "reservation_event_pending",
      reservationId: reservation.reservationId,
      runId,
      type: "SETTLEMENT_PENDING",
      actualUsdMicros: 19_000,
      createdAt: nowIso(),
    });

    const settled = await settleCostReservation({
      runId,
      reservationId: reservation.reservationId,
      actualUsdMicros: 19_000,
    });

    expect(settled.status).toBe("SETTLED");
    expect(
      (await readCostEvents(runId)).filter(
        (event) => event.reservationId === reservation.reservationId,
      ),
    ).toHaveLength(1);
  });

  it("marks an over-cap settlement uncertain until explicit reconciliation", async () => {
    const runId = await prepareReadyPaidRun(0.02);
    const reservation = await reserveApprovedCost({
      runId,
      stage: "tts",
      operationId: "over-cap",
    });

    await expect(
      settleCostReservation({
        runId,
        reservationId: reservation.reservationId,
        actualUsdMicros: 25_000,
      }),
    ).rejects.toThrow(/exceeds|uncertain/i);
    expect((await readCostReservationSummaries(runId))[0].status).toBe("UNCERTAIN");

    const reconciled = await reconcileCostReservation({
      runId,
      reservationId: reservation.reservationId,
      outcome: "settled",
      actualUsdMicros: 25_000,
      reason: "Provider invoice confirmed the final charge.",
    });

    expect(reconciled.status).toBe("SETTLED");
    expect(
      (await readCostEvents(runId)).find(
        (event) => event.reservationId === reservation.reservationId,
      )?.actualUsd,
    ).toBe(0.025);
  });

  it("keeps uncertain reservations active until reconciliation releases them", async () => {
    const runId = await prepareReadyPaidRun(0.02);
    const reservation = await reserveApprovedCost({
      runId,
      stage: "tts",
      operationId: "uncertain-release",
    });
    await markCostReservationUncertain({
      runId,
      reservationId: reservation.reservationId,
      reason: "Provider timeout after request submission.",
    });

    expect((await readCostReservationSummaries(runId))[0].status).toBe("UNCERTAIN");

    const reconciled = await reconcileCostReservation({
      runId,
      reservationId: reservation.reservationId,
      outcome: "released",
      reason: "Provider confirmed no charge and no work accepted.",
    });

    expect(reconciled.status).toBe("RELEASED");
  });
});

async function prepareReadyPaidRun(estimatedUsd: number): Promise<string> {
  defaultStagePricing.tts.estimatedUsd = estimatedUsd;
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
  await approveScript(runId);
  await generateProductionPackage(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  await approvePaidGenerationCost(runId);
  const readinessResult = await runReadiness(runId);
  expect(readinessResult.passed).toBe(true);
  const run = await loadRun(runId);
  expect(run.state).toBe("READY_FOR_MANUAL_PRODUCTION");
  return runId;
}
