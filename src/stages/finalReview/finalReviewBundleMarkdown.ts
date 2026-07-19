import { bulletList, table } from "../../utils/markdown.js";
import type { CurrentFinalReviewBundle } from "./finalReviewBundleContracts.js";

/**
 * Renders the local final review bundle as operator Markdown.
 *
 * @param bundle - The final review bundle to render.
 * @returns The Markdown handoff document.
 */
export function renderFinalReviewBundleMarkdown(bundle: CurrentFinalReviewBundle): string {
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
        ["YouTube chapter draft", bundle.draftRender.chapters.markdownPath],
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
    "## Soundtrack, Rights, and Mastering",
    "",
    table(
      ["Field", "Value"],
      [
        ["Soundtrack manifest", bundle.media.soundtrack.manifestPath],
        ["Soundtrack SHA-256", bundle.media.soundtrack.manifestDigest],
        ["Soundtrack mode/revision", `${bundle.media.soundtrack.mode} / ${bundle.media.soundtrack.revision}`],
        ["Soundtrack decision", `${bundle.media.soundtrack.decision.status} at ${bundle.media.soundtrack.decision.decidedAt}`],
        ["Rights/provenance", rightsProvenanceSummary(bundle)],
        ["Mastering target", masteringTargetSummary(bundle)],
        ["Mastered output", masteringOutputSummary(bundle)],
        ["Mastering pass", String(bundle.media.mastering.passed)],
        ["Encoding evidence", encodingSummary(bundle)],
        ["Render approval", `v${bundle.media.renderApproval.contractVersion} (${bundle.media.renderApproval.approvedRef})`],
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

function rightsProvenanceSummary(bundle: CurrentFinalReviewBundle): string {
  const { rightsProvenance } = bundle.media;
  const bases = rightsProvenance.rightsBases
    .map(({ basis, assetCount }) => `${basis}: ${assetCount}`)
    .join(", ");
  return `${rightsProvenance.assetCount} tracked assets (${rightsProvenance.musicAssetCount} music, ${rightsProvenance.sfxAssetCount} SFX); ${bases || "no imported soundtrack assets"}`;
}

function masteringTargetSummary(bundle: CurrentFinalReviewBundle): string {
  const { target } = bundle.media.mastering;
  return `${target.integratedLufs} LUFS ±${target.toleranceLufs}; max true peak ${target.maxOutputTruePeakDbtp} dBTP; LRA ≤${target.loudnessRangeLufs} LU`;
}

function masteringOutputSummary(bundle: CurrentFinalReviewBundle): string {
  const { output } = bundle.media.mastering;
  return `${output.integratedLufs} LUFS; ${output.truePeakDbtp} dBTP true peak; ${output.loudnessRangeLufs} LU LRA`;
}

function encodingSummary(bundle: CurrentFinalReviewBundle): string {
  const { encoding } = bundle.media;
  return `${encoding.container}; ${encoding.videoCodec} video + ${encoding.audioCodec} audio; ${encoding.audioSampleRateHz} Hz; ${encoding.audioChannels} channels`;
}

function mediaSummary(bundle: CurrentFinalReviewBundle): string {
  const { media } = bundle.draftRender;
  return `${media.width}x${media.height} ${media.videoCodec} + ${media.audioCodec}`;
}

function renderDecisionMarkdownLines(decision: CurrentFinalReviewBundle["renderDecision"]): string[] {
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
