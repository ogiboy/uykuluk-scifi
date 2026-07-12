import { describe, expect, it } from "vitest";
import { createRun, saveRun } from "../src/core/runStore";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { formatApprovalLedger, formatWarningDetails } from "../src/stages/status/statusLedger";
import { useTempProject } from "./helpers";

describe("operator status approval and warning details", () => {
  useTempProject();

  it("shows persisted approval ledger entries and warning messages in status output", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      approvals: [
        {
          approvalId: "approval_status_script",
          runId: run.runId,
          target: "script",
          approvedRef: "script-digest",
          previousState: "SCRIPT_REVIEWED",
          nextState: "SCRIPT_APPROVED",
          approvingCommand: "producer approve script --acknowledge-warnings",
          acknowledgedWarnings: ["too_short", "needs_fact_check"],
          createdAt: "2026-06-23T00:00:00.000Z",
        },
      ],
      state: "SCRIPT_APPROVED",
      warnings: ["Script is shorter than target length.", "Needs manual science fact check."],
    });

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Approval ledger:");
    expect(output).toContain(
      "- script approval · SCRIPT_REVIEWED -> SCRIPT_APPROVED · ref script-digest · via producer approve script --acknowledge-warnings · 2 acknowledged warning(s) · 2026-06-23T00:00:00.000Z",
    );
    expect(output).toContain("Warning details:");
    expect(output).toContain("- Script is shorter than target length.");
    expect(output).toContain("- Needs manual science fact check.");
  });

  it("keeps empty approval and warning sections out of status output", () => {
    expect(formatApprovalLedger([])).toEqual([]);
    expect(formatWarningDetails([])).toEqual([]);
  });
});
