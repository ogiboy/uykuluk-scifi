import { table } from "../../utils/markdown.js";
import type { DraftRenderManifest } from "../renderEvidence.js";
import { renderOperatorDecisionSection } from "../review/operatorReviewMarkdown.js";
import { renderDecisionCommandTemplates } from "./renderDecisionCommands.js";

/**
 * Builds the copy-pasteable local decision command section.
 *
 * @param manifest - The draft render manifest under review.
 * @returns Markdown lines for all allowed local render-review decisions.
 */
export function decisionCommandSection(manifest: DraftRenderManifest): string[] {
  return [
    "## Decision Commands",
    "",
    "After reviewing the local MP4, record exactly one durable local decision. These commands do not approve upload or publish.",
    "",
    table(
      ["Decision", "When to use", "Command"],
      renderDecisionCommandTemplates(manifest.runId).map((item) => [
        item.decision,
        item.guidance,
        `\`${item.command}\``,
      ]),
    ),
    "",
  ];
}

/**
 * Builds the operator decision section for a draft render review.
 *
 * @param manifest - The draft render manifest.
 * @returns The markdown lines for the decision section.
 */
export function renderDraftDecision(manifest: DraftRenderManifest): string[] {
  const timingDraftGate = manifest.voiceoverAudio.productionVoiceCandidate
    ? []
    : [
        "Confirm this MP4 used deterministic reference audio; treat it as a local timing draft, not final production voice.",
      ];
  const timingDraftNextStep = manifest.voiceoverAudio.productionVoiceCandidate
    ? []
    : [
        "Regenerate voiceover with a reviewed production-quality provider before final production voice review.",
      ];
  return renderOperatorDecisionSection({
    reviewGates: [
      "Watch the complete MP4 locally and verify audio, subtitles, popup cards, overlays, watermark, intro/outro, and timing.",
      ...timingDraftGate,
      "Confirm media probe evidence matches the expected local review output before treating the draft as ready for manual channel review.",
      "Confirm render output is local review media only; it does not grant upload or publish authority.",
    ],
    acceptableNextSteps: [
      `Keep the local draft with run ${manifest.runId} for manual review or external editing.`,
      ...timingDraftNextStep,
      "Wait for a future private-upload feature with separate config and approval before any YouTube upload.",
    ],
    revisionSteps: [
      `Record a non-accepted decision, archive the active draft with \`pnpm producer revise render --run ${manifest.runId}\`, then obtain a fresh exact render approval after corrections.`,
      "Revise the production package, render plan, voiceover, subtitles, or visual assets as needed, then regenerate evidence/readiness and the draft render.",
      "Do not upload, schedule, or publish an unacceptable local draft.",
    ],
    blockedActions: [
      "Private upload remains disabled until a separate future upload approval and configuration exist.",
      "Scheduled/public publish remains disabled and requires a separate future risk review.",
      "Any additional paid-provider generation remains separately cost-approved and evidence-bound.",
    ],
  });
}
