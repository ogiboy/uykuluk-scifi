import { describe, expect, it } from "vitest";
import { createHostedVisualGenerationOperationId } from "../src/stages/visuals/visualGenerationOperation";

describe("hosted visual generation operation identity", () => {
  const input = {
    runId: "run_visual_operation",
    planDigest: "a".repeat(64),
    quoteDigest: "b".repeat(64),
    approvalId: "approval_visual_operation",
  };

  it("is deterministic and bound to the exact plan, quote, and approval", () => {
    const operationId = createHostedVisualGenerationOperationId(input);

    expect(operationId).toMatch(/^image_[a-f0-9]{64}$/);
    expect(createHostedVisualGenerationOperationId(input)).toBe(operationId);
    expect(
      createHostedVisualGenerationOperationId({ ...input, planDigest: "c".repeat(64) }),
    ).not.toBe(operationId);
    expect(
      createHostedVisualGenerationOperationId({ ...input, quoteDigest: "d".repeat(64) }),
    ).not.toBe(operationId);
    expect(
      createHostedVisualGenerationOperationId({ ...input, approvalId: "approval_changed" }),
    ).not.toBe(operationId);
  });
});
