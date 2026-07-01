import { bulletList, table } from "../utils/markdown.js";
import type { FinalReviewBundle } from "./finalReviewBundleContracts.js";

/**
 * Renders the local final review bundle as operator Markdown.
 *
 * @param bundle - The final review bundle to render.
 * @returns The Markdown handoff document.
 */
export function renderFinalReviewBundleMarkdown(bundle: FinalReviewBundle): string {
  return [
    "# Local Final Review Handoff",
    "",
    `Run: ${bundle.runId}`,
    `Status: ${bundle.status}`,
    `Created at: ${bundle.createdAt}`,
    "",
    bundle.summary,
    "",
    "## Draft Render",
    "",
    table(
      ["Field", "Value"],
      [
        ["MP4", bundle.draftRender.path],
        ["SHA-256", bundle.draftRender.sha256],
        ["Duration", `${bundle.draftRender.durationSeconds}s`],
        ["Media", mediaSummary(bundle)],
        ["Review document", bundle.draftRender.reviewPath],
        [
          "Timestamped map",
          "Open the draft review document and check each MP4 segment against its timestamped review row.",
        ],
        ["Review command", bundle.draftRender.reviewCommand],
      ],
    ),
    "",
    "## Review Artifacts",
    "",
    table(
      ["Phase", "Artifact", "Operator action"],
      bundle.artifacts.map((artifact) => [
        artifact.reviewPhase,
        artifact.path,
        artifact.operatorAction,
      ]),
    ),
    "",
    "## Voiceover",
    "",
    table(
      ["Field", "Value"],
      [
        ["Path", bundle.voiceover.path],
        ["Mode", bundle.voiceover.mode],
        ["Quality", bundle.voiceover.quality],
        ["Production candidate", String(bundle.voiceover.productionVoiceCandidate)],
        ["Render approval scope", bundle.voiceover.renderApprovalScope],
      ],
    ),
    "",
    "## Render Plan",
    "",
    table(
      ["Field", "Value"],
      [
        ["Render plan", bundle.renderPlan.path],
        ["Contact sheet", bundle.renderPlan.contactSheetPath],
        ["Asset provenance", bundle.renderPlan.assetProvenancePath],
        ["Scenes", String(bundle.renderPlan.sceneCount)],
        ["Estimated duration", `${Math.round(bundle.renderPlan.estimatedDraftDurationSeconds)}s`],
      ],
    ),
    "",
    "## Render Decision",
    "",
    ...renderDecisionMarkdownLines(bundle.renderDecision),
    "",
    "## Next Safe Action",
    "",
    bundle.nextSafeAction,
    "",
    "## Still Blocked",
    "",
    bulletList(bundle.blockedActions),
  ].join("\n");
}

function mediaSummary(bundle: FinalReviewBundle): string {
  const { media } = bundle.draftRender;
  return `${media.width}x${media.height} ${media.videoCodec} + ${media.audioCodec}`;
}

function renderDecisionMarkdownLines(decision: FinalReviewBundle["renderDecision"]): string[] {
  if (decision.kind === "present") {
    return [
      `Decision: ${decision.decision}`,
      `Reviewed by: ${decision.reviewedBy}`,
      `Created at: ${decision.createdAt}`,
      `Review command: ${decision.reviewCommand}`,
      "",
      "Notes:",
      "",
      decision.notes,
    ];
  }
  return [
    "Decision: pending",
    `Next decision command: ${decision.nextAction}`,
    "",
    "Decision command templates:",
    ...decision.commandTemplates.map((template) => `- ${template.decision}: ${template.command}`),
  ];
}
