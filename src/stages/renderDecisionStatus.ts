import type { RunRecord } from "../core/state.js";
import { readJsonFile } from "../utils/json.js";
import { renderDecisionArtifactPaths } from "./renderDecision.js";
import { renderDecisionRecordSchema, type RenderDecisionRecord } from "./renderDecision.js";
import { reviewDraftRender } from "./reviewRender.js";

export type RenderDecisionStatus =
  | { kind: "missing"; nextAction: string | null }
  | { kind: "invalid"; message: string; nextAction: string }
  | { kind: "stale"; message: string; nextAction: string }
  | { decision: RenderDecisionRecord; kind: "present"; message: string; nextAction: string };

/**
 * Reads the local render decision status for a run.
 *
 * Returns `missing` when no decision artifact is present, `stale` when the stored decision no longer matches the current run context, `invalid` when the artifact cannot be trusted, and `present` when a valid decision is available.
 *
 * @param run - The run whose render decision should be inspected.
 * @returns The current render decision status.
 */
export async function readRenderDecisionStatus(run: RunRecord): Promise<RenderDecisionStatus> {
  const nextAction = renderDecisionNextAction(run.runId);
  try {
    const decision = renderDecisionRecordSchema.parse(
      await readJsonFile<unknown>(renderDecisionArtifactPaths(run.runId).json),
    );
    if (decision.runId !== run.runId) {
      return {
        kind: "stale",
        message: "Render decision belongs to a different run.",
        nextAction,
      };
    }
    const staleReason = await renderDecisionStaleReason(run, decision);
    if (staleReason) {
      return { kind: "stale", message: staleReason, nextAction };
    }
    return {
      decision,
      kind: "present",
      message: `Render decision recorded: ${decision.decision}.`,
      nextAction: decision.nextSafeAction,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        kind: "missing",
        nextAction: run.state === "RENDERED" ? nextAction : null,
      };
    }
    return {
      kind: "invalid",
      message: `Render decision could not be trusted: ${
        error instanceof Error ? error.message : String(error)
      }`,
      nextAction,
    };
  }
}

/**
 * Builds the command template for recording a render decision.
 *
 * @param runId - The run identifier to include in the command.
 * @returns The render-decision command template for `runId`.
 */
export function renderDecisionNextAction(runId: string): string {
  return `pnpm producer decide render --run ${runId} --decision accepted-for-local-review --notes "<notes>"`;
}

/**
 * Determines whether a render decision is stale for the current run context.
 *
 * @param run - The run to compare against
 * @param decision - The recorded render decision to check
 * @returns A stale-reason message if the decision no longer matches the current run, or `null` if it is still valid
 */
async function renderDecisionStaleReason(
  run: RunRecord,
  decision: RenderDecisionRecord,
): Promise<string | null> {
  if (run.state !== "RENDERED") {
    return `Render decision was recorded, but the run is ${run.state}.`;
  }
  const manifest = await reviewDraftRender(run.runId);
  if (decision.draftRender.sha256 !== manifest.output.sha256) {
    return "Render decision was recorded for a different draft render digest.";
  }
  if (decision.renderApproval.approvalId !== manifest.renderApproval.approvalId) {
    return "Render decision was recorded for a different render approval.";
  }
  if (decision.renderApproval.approvedRef !== manifest.renderApproval.approvedRef) {
    return "Render decision was recorded for a different render approval ref.";
  }
  return null;
}
