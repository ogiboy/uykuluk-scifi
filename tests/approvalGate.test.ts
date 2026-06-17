import { describe, expect, it } from "vitest";
import { requireApproval } from "../src/safeguards/approvalGuard";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { runIdeas } from "../src/stages/ideas";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { loadRun } from "../src/core/runStore";
import { readLedger } from "../src/core/ledger";
import { useTempProject } from "./helpers";

describe("approval guard", () => {
  useTempProject();

  it("records explicit approval events", async () => {
    const { runId, ideas } = await runIdeas();
    const approval = await approveIdea(runId, ideas[0].id);
    const ledger = await readLedger(runId);
    expect(approval.target).toBe("idea");
    expect(
      ledger.some((event) => event.type === "APPROVAL_RECORDED" && event.stage === "approve-idea"),
    ).toBe(true);
  });

  it("does not let stale approvals authorize unrelated stages", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    const run = await loadRun(runId);
    await expect(requireApproval(run, "script", "package")).rejects.toThrow(
      /requires explicit script approval/,
    );
  });

  it("requires review artifact before script approval", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await expect(approveScript(runId)).rejects.toThrow(/requires state SCRIPT_REVIEWED/);
    await reviewScript(runId);
    await expect(approveScript(runId)).resolves.toMatchObject({ target: "script" });
  });
});
