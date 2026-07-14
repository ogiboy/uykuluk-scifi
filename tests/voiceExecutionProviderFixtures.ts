import { vi } from "vitest";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import type { ReservedProviderAdapter } from "../src/costs/reservedProviderExecution";
import type {
  ReservedTtsProvider,
  TtsSynthesisResult,
} from "../src/stages/voice/providers/ttsProvider";

export function reservedProvider(
  bindingDigest: string,
  execute: ReservedProviderAdapter<TtsSynthesisResult>["execute"],
): ReservedTtsProvider {
  return {
    mode: "elevenlabs",
    executionPolicy: "reserved-paid",
    assertReady: vi.fn(),
    createReservedAdapter: () => ({
      provider: "elevenlabs",
      model: "eleven_v3",
      bindingDigest,
      execute,
    }),
  };
}

export async function approvedQuote(
  runId: string,
): Promise<{ quoteDigest: string; approvalId: string }> {
  const quoteDigest = (await readCostEstimate(runId)).digest;
  const approval = (await loadRun(runId)).approvals.find(
    (item) => item.target === "paid-generation-cost" && item.approvedRef === quoteDigest,
  );
  if (!approval) throw new Error("Expected paid quote approval fixture.");
  return { quoteDigest, approvalId: approval.approvalId };
}
