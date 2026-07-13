import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config/config";
import { readLedger } from "../src/core/ledger";
import { createRun } from "../src/core/runStore";
import { readCostEvents } from "../src/costs/costLedger";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { defaultStagePricing } from "../src/costs/pricing";
import { executeReservedProviderOperation } from "../src/costs/reservedProviderExecution";
import { sha256 } from "../src/utils/hash";
import { useTempProject } from "./helpers";
import { prepareReadyPaidRun, reservedAdapter } from "./paidRun";

describe("reserved provider execution", () => {
  useTempProject();

  const originalTtsPrice = defaultStagePricing.tts.estimatedUsd;
  const originalTtsProvider = defaultStagePricing.tts.provider;

  afterEach(() => {
    defaultStagePricing.tts.estimatedUsd = originalTtsPrice;
    defaultStagePricing.tts.provider = originalTtsProvider;
  });

  it("does not invoke the adapter before readiness and exact cost approval", async () => {
    const run = await createRun();
    const execute = vi.fn();

    await expect(
      executeReservedProviderOperation({
        runId: run.runId,
        stage: "tts",
        operationId: "tts-blocked",
        timeoutMs: 50,
        adapter: reservedAdapter(execute),
      }),
    ).rejects.toThrow(/ready_for_manual_production|cost reservation requires state/i);

    expect(execute).not.toHaveBeenCalled();
    expect(await readCostReservationSummaries(run.runId)).toEqual([]);
  });

  it("rejects an adapter identity mismatch before reservation or callback", async () => {
    const runId = await prepareReadyPaidRun();
    const execute = vi.fn();

    await expect(
      executeReservedProviderOperation({
        runId,
        stage: "tts",
        operationId: "tts-wrong-adapter",
        timeoutMs: 50,
        adapter: reservedAdapter(execute, "different-provider"),
      }),
    ).rejects.toThrow(/provider.*quote|adapter.*provider/i);

    expect(execute).not.toHaveBeenCalled();
    expect(await readCostReservationSummaries(runId)).toEqual([]);
  });

  it("does not invoke the adapter when relevant config changed after approval", async () => {
    const runId = await prepareReadyPaidRun();
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          providers: {
            ...defaultConfig.providers,
            tts: { ...defaultConfig.providers.tts, enabled: true, mode: "deterministic-local" },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const execute = vi.fn();

    await expect(
      executeReservedProviderOperation({
        runId,
        stage: "tts",
        operationId: "tts-stale-config",
        timeoutMs: 50,
        adapter: reservedAdapter(execute),
      }),
    ).rejects.toThrow(/stale|config changed|approved quote/i);
    expect(execute).not.toHaveBeenCalled();
    expect(await readCostReservationSummaries(runId)).toEqual([]);
  });

  it("persists the execution claim before callback and settles exact usage", async () => {
    const runId = await prepareReadyPaidRun();
    const execute = vi.fn(async () => {
      expect(await readCostReservationSummaries(runId)).toContainEqual(
        expect.objectContaining({ operationId: "tts-success", status: "EXECUTION_STARTED" }),
      );
      expect(await readLedger(runId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "COST_RESERVED" }),
          expect.objectContaining({ type: "COST_EXECUTION_STARTED" }),
        ]),
      );
      return {
        kind: "success" as const,
        value: { artifact: "voice.wav" },
        actualUsdMicros: 18_000,
        inputTokens: 12,
        outputTokens: 34,
        providerRequestId: "request_123",
      };
    });

    const result = await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-success",
      timeoutMs: 100,
      adapter: reservedAdapter(execute),
    });

    expect(result).toMatchObject({
      status: "completed",
      value: { artifact: "voice.wav" },
      reservation: {
        status: "SETTLED",
        actualUsdMicros: 18_000,
        providerRequestIdHash: sha256("request_123"),
      },
    });
    expect(await readCostEvents(runId)).toContainEqual(
      expect.objectContaining({
        reservationId: result.reservation.reservationId,
        actualUsd: 0.018,
        inputTokens: 12,
        outputTokens: 34,
      }),
    );
  });

  it("releases an explicitly definitely-not-sent outcome without recording cost", async () => {
    const runId = await prepareReadyPaidRun();

    const result = await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-not-sent",
      timeoutMs: 100,
      adapter: reservedAdapter(async () => ({
        kind: "definitely-not-sent",
        reason: "adapter-validation",
      })),
    });

    expect(result.status).toBe("definitely-not-sent");
    expect(result.reservation.status).toBe("RELEASED");
    expect(
      (await readCostEvents(runId)).filter(
        (event) => event.reservationId === result.reservation.reservationId,
      ),
    ).toEqual([]);
  });
});
