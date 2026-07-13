import { afterEach, describe, expect, it, vi } from "vitest";

import { readLedger } from "../src/core/ledger";
import { createRun } from "../src/core/runStore";
import {
  appendCostReservationEvent,
  readCostReservationEvents,
  readCostReservationSummaries,
} from "../src/costs/costReservationStore";
import { defaultStagePricing } from "../src/costs/pricing";
import {
  executeReservedProviderOperation,
  type ReservedProviderCallContext,
} from "../src/costs/reservedProviderExecution";
import { useTempProject } from "./helpers";
import { prepareReadyPaidRun, reservedAdapter } from "./paidRun";

describe("reserved provider execution binding", () => {
  useTempProject();

  afterEach(() => {
    delete defaultStagePricing.tts.bindingDigest;
  });

  it("rejects the same provider when its execution binding differs from the approved quote", async () => {
    defaultStagePricing.tts.bindingDigest = "a".repeat(64);
    const runId = await prepareReadyPaidRun();
    const execute = vi.fn();

    await expect(
      executeReservedProviderOperation({
        runId,
        stage: "tts",
        operationId: "tts-wrong-binding",
        timeoutMs: 50,
        adapter: { ...reservedAdapter(execute), bindingDigest: "b".repeat(64) },
      }),
    ).rejects.toThrow(/adapter.*binding|binding.*approved quote/i);

    expect(execute).not.toHaveBeenCalled();
    expect(await readCostReservationSummaries(runId)).toEqual([]);
  });

  it("persists the approved binding through reservation, claim, and callback context", async () => {
    const bindingDigest = "c".repeat(64);
    defaultStagePricing.tts.bindingDigest = bindingDigest;
    const runId = await prepareReadyPaidRun();
    let observedContext: ReservedProviderCallContext | undefined;

    const result = await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-bound-success",
      timeoutMs: 100,
      adapter: {
        ...reservedAdapter(async (context) => {
          observedContext = context;
          return { kind: "success", value: "ok", actualUsdMicros: 10_000 };
        }),
        bindingDigest,
      },
    });

    expect(observedContext).toMatchObject({ operationId: "tts-bound-success", bindingDigest });
    expect(result.reservation).toMatchObject({ bindingDigest, status: "SETTLED" });
    expect(await readCostReservationEvents(runId)).toContainEqual(
      expect.objectContaining({ type: "RESERVED", bindingDigest }),
    );
    expect(await readCostReservationEvents(runId)).toContainEqual(
      expect.objectContaining({ type: "EXECUTION_STARTED", bindingDigest }),
    );
    expect(await readLedger(runId)).toContainEqual(
      expect.objectContaining({
        type: "COST_EXECUTION_STARTED",
        data: expect.objectContaining({ bindingDigest }),
      }),
    );
  });

  it.each([
    { label: "missing", executionBindingDigest: undefined },
    { label: "different", executionBindingDigest: "d".repeat(64) },
  ])(
    "rejects an EXECUTION_STARTED event with a $label binding digest",
    async ({ executionBindingDigest }) => {
      const run = await createRun();
      const bindingDigest = "c".repeat(64);
      const reservationId = "reservation_binding_guard";
      const createdAt = new Date().toISOString();
      await appendCostReservationEvent({
        eventId: "reservation_event_reserved",
        reservationId,
        runId: run.runId,
        type: "RESERVED",
        operationId: "tts-binding-guard",
        approvalId: "approval_binding_guard",
        quoteDigest: "a".repeat(64),
        stage: "tts",
        provider: "elevenlabs",
        model: "eleven_v3",
        bindingDigest,
        maxUsdMicros: 10_000,
        createdAt,
      });

      await expect(
        appendCostReservationEvent({
          eventId: "reservation_event_started",
          reservationId,
          runId: run.runId,
          type: "EXECUTION_STARTED",
          provider: "elevenlabs",
          model: "eleven_v3",
          ...(executionBindingDigest ? { bindingDigest: executionBindingDigest } : {}),
          createdAt,
        }),
      ).rejects.toThrow(/identity.*reservation|binding/i);
      await expect(readCostReservationSummaries(run.runId)).resolves.toEqual([
        expect.objectContaining({ reservationId, status: "RESERVED", bindingDigest }),
      ]);
    },
  );
});
