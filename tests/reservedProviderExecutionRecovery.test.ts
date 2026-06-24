import { afterEach, describe, expect, it, vi } from "vitest";
import { readCostEvents } from "../src/costs/costLedger";
import { beginCostReservationExecution } from "../src/costs/costReservationExecutionState";
import {
  releaseCostReservation,
  reserveApprovedCost,
  settleCostReservation,
} from "../src/costs/costReservationService";
import { executeReservedProviderOperation } from "../src/costs/reservedProviderExecution";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { defaultStagePricing } from "../src/costs/pricing";
import { artifactPath } from "../src/core/artifacts";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { sha256 } from "../src/utils/hash";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import { paidAdapterIdentity, prepareReadyPaidRun, reservedAdapter } from "./paidRun";

describe("reserved provider execution recovery", () => {
  useTempProject();

  const originalTtsPrice = defaultStagePricing.tts.estimatedUsd;
  const originalTtsProvider = defaultStagePricing.tts.provider;

  afterEach(() => {
    defaultStagePricing.tts.estimatedUsd = originalTtsPrice;
    defaultStagePricing.tts.provider = originalTtsProvider;
  });

  it("does not invoke the adapter again after a settled same-operation retry", async () => {
    const runId = await prepareReadyPaidRun();
    await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-idempotent",
      timeoutMs: 100,
      adapter: reservedAdapter(async () => ({
        kind: "success",
        value: "done",
        actualUsdMicros: 15_000,
      })),
    });
    const retryExecute = vi.fn();

    const retry = await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-idempotent",
      timeoutMs: 100,
      adapter: reservedAdapter(retryExecute),
    });

    expect(retry.status).toBe("already-completed");
    expect(retryExecute).not.toHaveBeenCalled();
  });

  it("does not invoke the adapter again for released or uncertain same-operation retries", async () => {
    for (const outcome of [
      { kind: "definitely-not-sent" as const, reason: "adapter-validation" as const },
      { kind: "unknown" as const, reason: "transport" as const },
    ]) {
      const runId = await prepareReadyPaidRun();
      const operationId = `tts-${outcome.kind}`;
      await executeReservedProviderOperation({
        runId,
        stage: "tts",
        operationId,
        timeoutMs: 100,
        adapter: reservedAdapter(async () => outcome),
      });
      const retryExecute = vi.fn();

      const retry = await executeReservedProviderOperation({
        runId,
        stage: "tts",
        operationId,
        timeoutMs: 100,
        adapter: reservedAdapter(retryExecute),
      });

      expect(retry.status).toBe(
        outcome.kind === "definitely-not-sent" ? "definitely-not-sent" : "reconciliation-required",
      );
      expect(retryExecute).not.toHaveBeenCalled();
      expect(await readCostReservationSummaries(runId)).toHaveLength(1);
    }
  });

  it("allows at most one callback for concurrent same-operation execution", async () => {
    const runId = await prepareReadyPaidRun();
    const execute = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { kind: "success" as const, value: "done", actualUsdMicros: 10_000 };
    });
    const input = {
      runId,
      stage: "tts",
      operationId: "tts-concurrent",
      timeoutMs: 100,
      adapter: reservedAdapter(execute),
    };

    const results = await Promise.all([
      executeReservedProviderOperation(input),
      executeReservedProviderOperation(input),
    ]);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(
      results.map((result) => result.status).sort((left, right) => left.localeCompare(right)),
    ).toEqual(["completed", "reconciliation-required"]);
  });

  it("projects execution state and safe provider request evidence", async () => {
    const runId = await prepareReadyPaidRun();
    await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-evidence",
      timeoutMs: 100,
      adapter: reservedAdapter(async () => ({
        kind: "success",
        value: "done",
        actualUsdMicros: 12_000,
        providerRequestId: "sk_live_secret_evidence",
      })),
    });

    await generateEvidenceBundle(runId);
    const evidence = await readJsonFile<{
      costReservations: Array<{
        status: string;
        executionStartedAt?: string;
        providerRequestIdHash?: string;
      }>;
      generatedAt: string;
    }>(artifactPath(runId, "evidence_bundle.json"));

    expect(evidence.costReservations).toContainEqual(
      expect.objectContaining({
        status: "SETTLED",
        executionStartedAt: expect.any(String),
        providerRequestIdHash: sha256("sk_live_secret_evidence"),
      }),
    );
    expect(evidence.generatedAt).toEqual(expect.any(String));
    expect(JSON.stringify(evidence)).not.toContain("sk_live_secret_evidence");
  });

  it("projects uncertain execution as an unresolved internal action", async () => {
    const runId = await prepareReadyPaidRun();
    await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-uncertain-evidence",
      timeoutMs: 100,
      adapter: reservedAdapter(async () => ({
        kind: "unknown",
        reason: "transport",
      })),
    });

    await generateEvidenceBundle(runId);
    const evidence = await readJsonFile<{
      blockedActions: string[];
      nextRecommendedCommand: string;
    }>(artifactPath(runId, "evidence_bundle.json"));

    expect(evidence.blockedActions).toEqual(
      expect.arrayContaining([expect.stringMatching(/reservation.*active|uncertain/i)]),
    );
    expect(evidence.nextRecommendedCommand).toMatch(/internal cost reconciliation/i);
  });

  it("keeps a released quote line consumed for a different operation", async () => {
    const runId = await prepareReadyPaidRun();
    await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-released",
      timeoutMs: 100,
      adapter: reservedAdapter(async () => ({
        kind: "definitely-not-sent",
        reason: "adapter-validation",
      })),
    });
    const execute = vi.fn();

    await expect(
      executeReservedProviderOperation({
        runId,
        stage: "tts",
        operationId: "tts-new-operation",
        timeoutMs: 100,
        adapter: reservedAdapter(execute),
      }),
    ).rejects.toThrow(/consumed|new quote|approval/i);
    expect(execute).not.toHaveBeenCalled();
    expect((await readCostEvents(runId)).filter((event) => event.stage === "tts")).toEqual([]);
  });

  it("rejects generic release after execution has started", async () => {
    const runId = await prepareReadyPaidRun();
    const reservation = await reserveApprovedCost({
      runId,
      stage: "tts",
      operationId: "tts-release-guard",
      adapterIdentity: paidAdapterIdentity,
    });
    await beginCostReservationExecution({
      runId,
      reservationId: reservation.reservationId,
      adapterIdentity: paidAdapterIdentity,
    });

    await expect(
      releaseCostReservation({
        runId,
        reservationId: reservation.reservationId,
        reason: "Caller cannot prove non-submission.",
      }),
    ).rejects.toThrow(/cannot release.*execution_started/i);
  });

  it("rejects a conflicting provider request id on settled retry", async () => {
    const runId = await prepareReadyPaidRun();
    const completed = await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-receipt-retry",
      timeoutMs: 100,
      adapter: reservedAdapter(async () => ({
        kind: "success",
        value: "done",
        actualUsdMicros: 11_000,
        providerRequestId: "request_original",
      })),
    });

    await expect(
      settleCostReservation({
        runId,
        reservationId: completed.reservation.reservationId,
        actualUsdMicros: 11_000,
        providerRequestIdHash: sha256("request_conflict"),
      }),
    ).rejects.toThrow(/request id hash.*retry/i);
  });
});
