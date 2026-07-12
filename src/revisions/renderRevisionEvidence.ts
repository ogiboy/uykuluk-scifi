import { readFile } from "node:fs/promises";
import { z } from "zod";
import { artifactPath } from "../core/artifacts.js";
import type { RunRecord } from "../core/state.js";
import { renderDecisionJsonPath } from "../stages/render/renderDecisionCommands.js";
import { renderDecisionRecordSchema } from "../stages/render/renderDecisionContracts.js";
import { nowIso } from "../utils/time.js";
import { blockRenderRevision } from "./renderRevisionGuard.js";

export type RenderRevisionRecoveryOptions = { reason?: string; reviewedBy?: string };

export type RenderRevisionEvidence = {
  createdAt: string;
  decision: "needs-revision" | "rejected" | "invalid-evidence";
  reason: string;
  reviewedBy: string;
};

const legacyRenderManifestBindingSchema = z.looseObject({
  runId: z.string().min(1),
  output: z.looseObject({ sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
  renderApproval: z.looseObject({
    approvalId: z.string().min(1),
    approvedRef: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});

export async function resolveRenderRevisionEvidence(
  run: RunRecord,
  approvalId: string,
  approvedRef: string,
  draftRenderSha256: string,
  options: RenderRevisionRecoveryOptions,
): Promise<RenderRevisionEvidence> {
  const decision = await readOptionalRevisionDecision(run.runId);
  if (decisionMatchesActiveDraft(decision, run.runId, approvalId, approvedRef, draftRenderSha256)) {
    if (decision.decision === "accepted-for-local-review") {
      return blockRenderRevision(
        run.runId,
        "An accepted render decision cannot be revised. Record a non-accepted decision on the draft that requires replacement.",
      );
    }
    return {
      createdAt: decision.createdAt,
      decision: decision.decision,
      reason: decision.notes,
      reviewedBy: decision.reviewedBy,
    };
  }

  const reason = options.reason?.trim();
  const reviewedBy = options.reviewedBy?.trim();
  if (!reason || !reviewedBy) {
    return blockRenderRevision(
      run.runId,
      "Invalid render evidence recovery requires --reason and --reviewed-by attribution.",
    );
  }
  const manifest = await readLegacyRenderManifestBinding(run.runId);
  if (
    manifest.runId !== run.runId ||
    manifest.renderApproval.approvalId !== approvalId ||
    manifest.renderApproval.approvedRef !== approvedRef ||
    manifest.output.sha256 !== draftRenderSha256
  ) {
    return blockRenderRevision(
      run.runId,
      "Invalid render evidence recovery is stale for the active draft or approval.",
    );
  }
  return { createdAt: nowIso(), decision: "invalid-evidence", reason, reviewedBy };
}

type RevisionDecision = z.infer<typeof renderDecisionRecordSchema>;

function decisionMatchesActiveDraft(
  decision: RevisionDecision | undefined,
  runId: string,
  approvalId: string,
  approvedRef: string,
  draftRenderSha256: string,
): decision is RevisionDecision {
  return (
    decision?.runId === runId &&
    decision.renderApproval.approvalId === approvalId &&
    decision.renderApproval.approvedRef === approvedRef &&
    decision.draftRender.sha256 === draftRenderSha256
  );
}

async function readOptionalRevisionDecision(runId: string): Promise<RevisionDecision | undefined> {
  try {
    return renderDecisionRecordSchema.parse(
      JSON.parse(await readFile(artifactPath(runId, renderDecisionJsonPath), "utf8")),
    );
  } catch {
    return undefined;
  }
}

async function readLegacyRenderManifestBinding(runId: string) {
  try {
    return legacyRenderManifestBindingSchema.parse(
      JSON.parse(
        await readFile(artifactPath(runId, "production/render/render_manifest.json"), "utf8"),
      ),
    );
  } catch (error) {
    return blockRenderRevision(
      runId,
      `Invalid render evidence recovery could not validate the persisted manifest binding: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
