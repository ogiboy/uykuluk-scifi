import { readFile } from "node:fs/promises";
import { artifactPath } from "../core/artifacts";
import { appendLedgerEvent } from "../core/ledger";
import { loadRun, setRunState } from "../core/runStore";
import { assertTransition } from "../core/transitions";
import { ApprovalRecord } from "../core/state";
import { SafeExitError } from "../core/errors";
import { requireState } from "../safeguards/approvalGuard";
import { createId, nowIso } from "../utils/time";
import { VideoIdea } from "./types";

export async function approveIdea(runId: string, ideaId: string): Promise<ApprovalRecord> {
  let run = await loadRun(runId);
  await requireState(run, "IDEAS_GENERATED", "approve-idea");
  assertTransition(run.state, "IDEA_APPROVED");
  const ideas = JSON.parse(await readFile(artifactPath(run.runId, "ideas.json"), "utf8")) as {
    ideas: VideoIdea[];
  };
  if (!ideas.ideas.some((idea) => idea.id === ideaId)) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage: "approve-idea",
      message: `Idea not found: ${ideaId}.`,
      data: { ideaId },
    });
    throw new SafeExitError(`Idea not found in run ${runId}: ${ideaId}`);
  }
  const approval: ApprovalRecord = {
    approvalId: createId("approval"),
    runId: run.runId,
    target: "idea",
    approvedRef: ideaId,
    previousState: run.state,
    nextState: "IDEA_APPROVED",
    approvingCommand: "producer approve idea",
    createdAt: nowIso(),
  };
  run = {
    ...run,
    approvedIdeaId: ideaId,
    approvals: [...run.approvals.filter((item) => item.target !== "idea"), approval],
  };
  await appendLedgerEvent({
    runId: run.runId,
    type: "APPROVAL_RECORDED",
    stage: "approve-idea",
    message: `Idea approved: ${ideaId}.`,
    data: approval,
  });
  await setRunState(run, "IDEA_APPROVED", "approve-idea");
  return approval;
}
