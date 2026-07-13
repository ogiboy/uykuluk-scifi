import { afterEach, describe, expect, it } from "vitest";

import { defaultStagePricing } from "../src/costs/pricing";
import { executeReservedProviderOperation } from "../src/costs/reservedProviderExecution";
import { sha256 } from "../src/utils/hash";
import { useTempProject } from "./helpers";
import { prepareReadyPaidRun, reservedAdapter } from "./paidRun";

describe("reserved provider uncertain outcomes", () => {
  useTempProject();

  const originalTtsPrice = defaultStagePricing.tts.estimatedUsd;
  const originalTtsProvider = defaultStagePricing.tts.provider;

  afterEach(() => {
    defaultStagePricing.tts.estimatedUsd = originalTtsPrice;
    defaultStagePricing.tts.provider = originalTtsProvider;
  });

  it("keeps explicit unknown outcomes active for reconciliation", async () => {
    const runId = await prepareReadyPaidRun();

    const result = await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-unknown",
      timeoutMs: 100,
      adapter: reservedAdapter(async () => ({
        kind: "unknown",
        reason: "transport",
        providerRequestId: "request_unknown",
        requestEvidence: [
          {
            requestIndex: 0,
            inputDigest: sha256("provider-input"),
            requestIdHash: sha256("request_unknown"),
            reportedUnits: 7,
          },
        ],
      })),
    });

    expect(result.status).toBe("reconciliation-required");
    expect(result.reservation).toMatchObject({
      status: "UNCERTAIN",
      providerRequestIdHash: sha256("request_unknown"),
      requestEvidence: [
        {
          requestIndex: 0,
          inputDigest: sha256("provider-input"),
          requestIdHash: sha256("request_unknown"),
          reportedUnits: 7,
        },
      ],
    });
  });

  it("sanitizes unexpected callback errors and defaults them to uncertain", async () => {
    const runId = await prepareReadyPaidRun();

    const result = await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-throws",
      timeoutMs: 100,
      adapter: reservedAdapter(async () => {
        throw new Error("secret-provider-token");
      }),
    });

    expect(result.status).toBe("reconciliation-required");
    expect(result.reservation.status).toBe("UNCERTAIN");
    expect(result.reservation.reason).not.toContain("secret-provider-token");
  });

  it("aborts timed-out callbacks and marks the outcome uncertain", async () => {
    const runId = await prepareReadyPaidRun();
    let observedAbort = false;

    const result = await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-timeout",
      timeoutMs: 10,
      adapter: reservedAdapter(
        ({ signal }) =>
          new Promise((resolve) => {
            signal.addEventListener("abort", () => {
              observedAbort = true;
              resolve({ kind: "definitely-not-sent", reason: "cancelled-before-send" });
            });
          }),
      ),
    });

    expect(observedAbort).toBe(true);
    expect(result.status).toBe("reconciliation-required");
    expect(result.reservation.status).toBe("UNCERTAIN");
  });

  it("marks malformed success metadata uncertain instead of releasing it", async () => {
    const runId = await prepareReadyPaidRun();

    const result = await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "tts-invalid-success",
      timeoutMs: 100,
      adapter: reservedAdapter(async () => ({
        kind: "success",
        value: "invalid",
        actualUsdMicros: -1,
      })),
    });

    expect(result.status).toBe("reconciliation-required");
    expect(result.reservation.status).toBe("UNCERTAIN");
  });
});
