import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { pathExists } from "../utils/fs.js";
import { bulletList, table } from "../utils/markdown.js";
import { nowIso } from "../utils/time.js";
import { finalReviewBundleCommand } from "./finalReviewBundleContracts.js";
import {
  renderDecisionJsonPath,
  renderDecisionMarkdownPath,
  type RenderDecision,
} from "./renderDecisionCommands.js";
import {
  renderDecisionInputSchema,
  type RenderDecisionInput,
  type RenderDecisionRecord,
} from "./renderDecisionContracts.js";
import { reviewDraftRender } from "./reviewRender.js";

export {
  renderDecisionJsonPath,
  renderDecisionMarkdownPath,
  renderDecisionValues,
  type RenderDecision,
} from "./renderDecisionCommands.js";
export {
  renderDecisionInputSchema,
  renderDecisionRecordSchema,
} from "./renderDecisionContracts.js";
export type { RenderDecisionInput, RenderDecisionRecord } from "./renderDecisionContracts.js";

/**
 * Records an operator render decision after reviewing the local draft render.
 *
 * @param input - The render decision request.
 * @returns The persisted render decision record.
 * @throws SafeExitError If the run is not in the `RENDERED` state.
 */
export async function recordRenderDecision(
  input: RenderDecisionInput,
): Promise<RenderDecisionRecord> {
  const parsed = renderDecisionInputSchema.parse(input);
  let run = await loadRun(parsed.runId);
  if (run.state !== "RENDERED") {
    throw new SafeExitError("Render decision requires state RENDERED.");
  }
  if (await pathExists(renderDecisionArtifactPaths(run.runId).json)) {
    throw new SafeExitError(
      "Render decision already exists for this run. Cannot overwrite existing decision.",
    );
  }
  const manifest = await reviewDraftRender(run.runId);
  const record: RenderDecisionRecord = {
    blockedActions: [
      "Private upload remains disabled until a separate future upload approval and configuration exist.",
      "Scheduled/public publish remains disabled and requires a separate future risk review.",
    ],
    createdAt: nowIso(),
    decision: parsed.decision,
    draftRender: {
      durationSeconds: manifest.output.durationSeconds,
      path: manifest.output.path,
      reviewCommand: manifest.ffmpeg.reviewCommand,
      sha256: manifest.output.sha256,
    },
    nextSafeAction: renderDecisionNextSafeAction(parsed.decision, run.runId),
    notes: parsed.notes,
    renderApproval: manifest.renderApproval,
    reviewedBy: parsed.reviewedBy,
    runId: run.runId,
    schemaVersion: 1,
    voiceover: {
      mode: manifest.voiceoverAudio.mode,
      productionVoiceCandidate: manifest.voiceoverAudio.productionVoiceCandidate,
      quality: manifest.voiceoverAudio.quality,
    },
  };
  run = await writeRunJson(run, "decide-render", "production/render/render_decision.json", record);
  run = await writeRunText(
    run,
    "decide-render",
    "production/render/render_decision.md",
    renderDecisionMarkdown(record),
  );
  await saveRun(run);
  await appendLedgerEvent({
    runId: run.runId,
    type: "REVIEW_DECISION_RECORDED",
    stage: "decide-render",
    message: `Render review decision recorded: ${record.decision}.`,
    data: {
      decision: record.decision,
      draftRenderSha256: record.draftRender.sha256,
      reviewedBy: record.reviewedBy,
    },
  });
  return record;
}

/**
 * Renders a persisted render decision record as Markdown.
 *
 * @param record - The render decision record to render.
 * @returns A Markdown document for operators.
 */
export function renderDecisionMarkdown(record: RenderDecisionRecord): string {
  return [
    "# Draft Render Operator Decision",
    "",
    `Run: ${record.runId}`,
    `Decision: ${record.decision}`,
    `Reviewed by: ${record.reviewedBy}`,
    `Created at: ${record.createdAt}`,
    "",
    "## Draft Render",
    "",
    table(
      ["Field", "Value"],
      [
        ["Path", record.draftRender.path],
        ["SHA-256", record.draftRender.sha256],
        ["Duration", `${record.draftRender.durationSeconds}s`],
        ["Review command", record.draftRender.reviewCommand],
      ],
    ),
    "",
    "## Voiceover",
    "",
    table(
      ["Field", "Value"],
      [
        ["Mode", record.voiceover.mode],
        ["Quality", record.voiceover.quality],
        ["Production voice candidate", String(record.voiceover.productionVoiceCandidate)],
      ],
    ),
    "",
    "## Notes",
    "",
    record.notes,
    "",
    "## Next Safe Action",
    "",
    record.nextSafeAction,
    "",
    "## Still Blocked",
    "",
    bulletList(record.blockedActions),
  ].join("\n");
}

/**
 * Computes the next safe action for a render decision.
 *
 * @param decision - The recorded render decision
 * @param runId - The run identifier used in copy-pasteable commands.
 * @returns Guidance for the next allowed step based on `decision`
 */
export function renderDecisionNextSafeAction(decision: RenderDecision, runId: string): string {
  if (decision === "accepted-for-local-review") {
    return `Create the local final review handoff with ${finalReviewBundleCommand(runId)}. Upload remains disabled until a future private-upload approval/config path exists.`;
  }
  if (decision === "needs-revision") {
    return "Revise package, render plan, voiceover, subtitles, or assets; then regenerate evidence/readiness and render a new local draft.";
  }
  return "Do not use this draft. Revise upstream artifacts before any new render approval.";
}

/**
 * Resolves the render decision artifact paths for a run.
 *
 * @param runId - The run identifier.
 * @returns Absolute JSON and Markdown artifact paths.
 */
export function renderDecisionArtifactPaths(runId: string): { json: string; markdown: string } {
  return {
    json: artifactPath(runId, renderDecisionJsonPath),
    markdown: artifactPath(runId, renderDecisionMarkdownPath),
  };
}
