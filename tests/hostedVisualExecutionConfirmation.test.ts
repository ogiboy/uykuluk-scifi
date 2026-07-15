import { describe, expect, it } from "vitest";
import {
  hostedVisualExecutionConfirmationMatches,
  hostedVisualExecutionConfirmationSchema,
} from "../src/stages/visuals/hostedVisualExecutionConfirmation";

describe("hosted visual execution confirmation", () => {
  const expected = {
    approvalId: "approval_visual",
    bindingDigest: "a".repeat(64),
    quoteDigest: "b".repeat(64),
  };

  it("accepts only the exact current paid operation identity", () => {
    const confirmation = hostedVisualExecutionConfirmationSchema.parse({
      ...expected,
      confirmPaidOperation: true,
    });

    expect(hostedVisualExecutionConfirmationMatches(confirmation, expected)).toBe(true);
    expect(
      hostedVisualExecutionConfirmationMatches(
        { ...confirmation, bindingDigest: "c".repeat(64) },
        expected,
      ),
    ).toBe(false);
  });

  it("rejects an absent paid confirmation literal", () => {
    expect(() =>
      hostedVisualExecutionConfirmationSchema.parse({ ...expected, confirmPaidOperation: false }),
    ).toThrow();
  });
});
