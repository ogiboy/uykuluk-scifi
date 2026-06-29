import { z } from "zod";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { nowIso } from "../utils/time.js";
import { bulletList, table } from "../utils/markdown.js";
import { reviewDraftRender } from "./reviewRender.js";

export const renderDecisionValues = [
  "accepted-for-local-review",
  "needs-revision",
  "rejected",
] as const;

export const renderDecisionInputSchema = z.strictObject({
  decision: z.enum(renderDecisionValues),
  notes: z.string().trim().min(1).max(4_000),
  reviewedBy: z.string().trim().min(1).max(200),
  runId: z.string().min(1),
});

export type RenderDecisionInput = z.input<typeof renderDecisionInputSchema>;
export type RenderDecision = (typeof renderDecisionValues)[number];

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const renderDecisionRecordSchema = z.strictObject({
  blockedActions: z.array(z.string().min(1)),
  createdAt: z.iso.datetime(),
  decision: z.enum(renderDecisionValues),
  draftRender: z.strictObject({
    durationSeconds: z.number().positive(),
    path: z.string().min(1),
    reviewCommand: z.string().min(1),
    sha256: digestSchema,
  }),
  nextSafeAction: z.string().min(1),
  notes: z.string().min(1),
  renderApproval: z.strictObject({
    approvalId: z.string().min(1),
    approvedRef: digestSchema,
  }),
  reviewedBy: z.string().min(1),
  runId: z.string().min(1),
  schemaVersion: z.literal(1),
  voiceover: z.strictObject({
    mode: z.string().min(1),
    productionVoiceCandidate: z.boolean(),
    quality: z.string().min(1),
  }),
});

export type RenderDecisionRecord = z.infer<typeof renderDecisionRecordSchema>;

/**
 * Records the operator decision after local draft-render review.
 *
 * @param input - The render decision request.
 * @returns The persisted render decision record.
 */
export async function recordRenderDecision(
  input: RenderDecisionInput,
): Promise<RenderDecisionRecord> {
  const parsed = renderDecisionInputSchema.parse(input);
  let run = await loadRun(parsed.runId);
  if (run.state !== "RENDERED") {
    throw new SafeExitError("Render decision requires state RENDERED.");
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
    nextSafeAction: nextSafeAction(parsed.decision),
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
 * Renders the operator render decision as Markdown.
 *
 * @param record - The render decision record.
 * @returns Operator-readable Markdown.
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

function nextSafeAction(decision: RenderDecision): string {
  if (decision === "accepted-for-local-review") {
    return "Keep the local draft for manual channel review. Upload remains disabled until a future private-upload approval/config path exists.";
  }
  if (decision === "needs-revision") {
    return "Revise package, render plan, voiceover, subtitles, or assets; then regenerate evidence/readiness and render a new local draft.";
  }
  return "Do not use this draft. Revise upstream artifacts before any new render approval.";
}

export const renderDecisionJsonPath = "production/render/render_decision.json";
export const renderDecisionMarkdownPath = "production/render/render_decision.md";

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
