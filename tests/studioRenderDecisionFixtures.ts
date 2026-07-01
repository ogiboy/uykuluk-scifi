import { writeFile } from "node:fs/promises";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import {
  renderDecisionJsonPath,
  renderDecisionMarkdownPath,
} from "../src/stages/renderDecisionCommands";
import type { RenderDecisionRecord } from "../src/stages/renderDecisionContracts";

/**
 * Writes a Studio-valid render decision artifact for a rendered fixture run.
 *
 * @param runId - The run identifier.
 * @param decision - The local review outcome to persist.
 * @returns The persisted render decision record.
 */
export async function writeStudioRenderDecision(
  runId: string,
  decision: RenderDecisionRecord["decision"] = "accepted-for-local-review",
): Promise<RenderDecisionRecord> {
  const run = await loadRun(runId);
  const record: RenderDecisionRecord = {
    blockedActions: [
      "Private upload remains disabled until a separate future upload approval and configuration exist.",
      "Scheduled/public publish remains disabled and requires a separate future risk review.",
    ],
    createdAt: "2026-06-28T00:00:00.000Z",
    decision,
    draftRender: {
      durationSeconds: 8.2,
      path: "production/render/draft.mp4",
      reviewCommand: "ffmpeg -v error -i production/render/draft.mp4 -f null -",
      sha256: "a".repeat(64),
    },
    nextSafeAction: nextSafeAction(decision, runId),
    notes: "Reviewed locally from Studio fixture.",
    renderApproval: {
      approvalId: "approval_render_fixture",
      approvedRef: "d".repeat(64),
    },
    reviewedBy: "operator",
    runId,
    schemaVersion: 1,
    voiceover: {
      mode: "local-piper",
      productionVoiceCandidate: true,
      quality: "local-piper",
    },
  };
  await writeFile(artifactPath(runId, renderDecisionJsonPath), JSON.stringify(record), "utf8");
  await writeFile(
    artifactPath(runId, renderDecisionMarkdownPath),
    "# Draft Render Operator Decision\n\nReviewed locally.",
    "utf8",
  );
  await saveRun({
    ...run,
    artifacts: Array.from(
      new Set([...run.artifacts, renderDecisionJsonPath, renderDecisionMarkdownPath]),
    ),
  });
  return record;
}

function nextSafeAction(decision: RenderDecisionRecord["decision"], runId: string): string {
  if (decision === "accepted-for-local-review") {
    return `Create the local final review handoff with pnpm producer review-bundle --run ${runId}. Upload remains disabled until a future private-upload approval/config path exists.`;
  }
  if (decision === "needs-revision") {
    return "Revise package, render plan, voiceover, subtitles, or assets; then regenerate evidence/readiness and render a new local draft.";
  }
  return "Do not use this draft. Revise upstream artifacts before any new render approval.";
}
