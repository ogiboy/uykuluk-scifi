import { describe, expect, it } from "vitest";
import { formatApprovalLedgerItem } from "../apps/studio/src/lib/runLedgerCopy";

describe("Studio run ledger copy", () => {
  it("formats persisted approval ledger entries for operator review", () => {
    expect(
      formatApprovalLedgerItem(
        {
          acknowledgedWarnings: ["too_short", "needs_fact_check"],
          approvedRef: "script-digest",
          approvingCommand: "producer approve script",
          createdAt: "2026-06-23T00:00:00.000Z",
          nextState: "SCRIPT_APPROVED",
          previousState: "SCRIPT_REVIEWED",
          target: "script",
        },
        0,
      ),
    ).toBe(
      "script approval · SCRIPT_REVIEWED -> SCRIPT_APPROVED · ref script-digest · via producer approve script · 2 acknowledged warning(s) · 2026-06-23T00:00:00.000Z",
    );
  });

  it("keeps malformed approval entries inspectable without throwing", () => {
    expect(formatApprovalLedgerItem(null, 1)).toBe("Approval 2: uninspectable approval record.");
  });
});
