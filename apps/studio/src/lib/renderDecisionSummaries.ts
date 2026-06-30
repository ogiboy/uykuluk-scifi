import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  renderDecisionJsonPath,
  renderDecisionNextAction,
  renderDecisionReviewCommand,
} from "../../../../src/stages/renderDecisionCommands";
import {
  renderDecisionRecordSchema,
  type RenderDecisionRecord,
} from "../../../../src/stages/renderDecisionContracts";
import type { EvidenceStatus } from "../../../../src/stages/statusMediaSummary";
import { studioRunFilePath } from "./runFilePaths";
import type { RunRecord } from "./runSummaries";

export type StudioRenderDecisionSummary =
  | { kind: "missing"; message: string; nextAction: string | null }
  | { kind: "invalid"; message: string; nextAction: string }
  | { kind: "stale"; message: string; nextAction: string }
  | {
      decision: RenderDecisionRecord;
      kind: "present";
      message: string;
      nextAction: string;
      reviewCommand: string;
    };

const evidenceDraftRenderSchema = z.looseObject({
  status: z.literal("pass"),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  renderApproval: z.strictObject({
    approvalId: z.string().min(1),
    approvedRef: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});

/**
 * Reads the Studio-safe render decision summary for a run.
 *
 * The Studio only trusts a decision when the persisted record matches current draft-render
 * evidence. It does not call CLI transitions, ffprobe, providers, upload, or publish paths.
 *
 * @param root - The project root containing local run artifacts.
 * @param record - The persisted run record.
 * @param evidence - The current validated evidence snapshot, when available.
 * @returns A render decision summary for read-only operator surfaces.
 */
export async function readStudioRenderDecisionSummary(
  root: string,
  record: RunRecord,
  evidence: EvidenceStatus | null,
): Promise<StudioRenderDecisionSummary> {
  const runId = record.runId ?? "unknown";
  const nextAction = renderDecisionNextAction(runId);
  const target = studioRunFilePath(root, runId, renderDecisionJsonPath);
  if (!target) {
    return invalidDecision(runId, "Render decision path is invalid.");
  }

  try {
    const decision = renderDecisionRecordSchema.parse(JSON.parse(await readFile(target, "utf8")));
    return validateStudioRenderDecision(record, evidence, decision, nextAction);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return missingDecision(record, nextAction);
    }
    return invalidDecision(
      runId,
      `Render decision could not be trusted: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function validateStudioRenderDecision(
  record: RunRecord,
  evidence: EvidenceStatus | null,
  decision: RenderDecisionRecord,
  nextAction: string,
): StudioRenderDecisionSummary {
  if (decision.runId !== record.runId) {
    return staleDecision(nextAction, "Render decision belongs to a different run.");
  }
  if (record.state !== "RENDERED") {
    return staleDecision(
      nextAction,
      `Render decision was recorded, but the run is ${record.state ?? "unknown"}.`,
    );
  }
  const draftRender = evidenceDraftRenderSchema.safeParse(evidence?.draftRender);
  if (!draftRender.success) {
    return staleDecision(
      nextAction,
      "Render decision requires current passing draft-render evidence.",
    );
  }
  if (decision.draftRender.sha256 !== draftRender.data.digest) {
    return staleDecision(
      nextAction,
      "Render decision was recorded for a different draft render digest.",
    );
  }
  if (decision.renderApproval.approvalId !== draftRender.data.renderApproval.approvalId) {
    return staleDecision(
      nextAction,
      "Render decision was recorded for a different render approval.",
    );
  }
  if (decision.renderApproval.approvedRef !== draftRender.data.renderApproval.approvedRef) {
    return staleDecision(
      nextAction,
      "Render decision was recorded for a different render approval ref.",
    );
  }
  return {
    decision,
    kind: "present",
    message: `Render decision recorded: ${decision.decision}.`,
    nextAction: decision.nextSafeAction,
    reviewCommand: renderDecisionReviewCommand(decision.runId),
  };
}

function missingDecision(
  record: RunRecord,
  nextAction: string,
): Extract<StudioRenderDecisionSummary, { kind: "missing" }> {
  if (record.artifacts?.includes(renderDecisionJsonPath)) {
    return {
      kind: "missing",
      message: "Render decision is listed in run artifacts but the JSON file is missing.",
      nextAction,
    };
  }
  return {
    kind: "missing",
    message: "Render decision has not been recorded.",
    nextAction: record.state === "RENDERED" ? nextAction : null,
  };
}

function invalidDecision(
  runId: string,
  message: string,
): Extract<StudioRenderDecisionSummary, { kind: "invalid" }> {
  return { kind: "invalid", message, nextAction: renderDecisionNextAction(runId) };
}

function staleDecision(
  nextAction: string,
  message: string,
): Extract<StudioRenderDecisionSummary, { kind: "stale" }> {
  return { kind: "stale", message, nextAction };
}
