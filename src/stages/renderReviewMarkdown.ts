import { bulletList, table } from "../utils/markdown.js";
import { renderOperatorDecisionSection } from "./operatorReviewMarkdown.js";
import type { DraftRenderManifest } from "./renderEvidence.js";

/**
 * Builds the draft render review markdown document.
 *
 * @param manifest - The draft render manifest to format.
 * @returns The rendered markdown review document.
 */
export function renderDraftReviewMarkdown(manifest: DraftRenderManifest): string {
  const sections = [
    "# Draft Render Review",
    "",
    `Run: ${manifest.runId}`,
    `Generated at: ${manifest.createdAt}`,
    "",
    "> Local review artifact only. This does not approve upload, schedule, public publish, or paid provider execution.",
    "",
    "## Output",
    "",
    table(
      ["Artifact", "Value"],
      [
        ["Draft MP4", manifest.output.path],
        ["Duration", `${manifest.output.durationSeconds}s`],
        ["Bytes", String(manifest.output.bytes)],
        ["SHA-256", manifest.output.sha256],
      ],
    ),
    "",
  ];
  sections.push(
    "## Media Probe",
    "",
    table(
      ["Probe", "Value"],
      [
        ["Binary", manifest.mediaProbe.binary],
        ["Container", manifest.mediaProbe.formatName ?? "unknown"],
        ["Duration", `${manifest.mediaProbe.durationSeconds}s`],
        [
          "Video",
          `${manifest.mediaProbe.video.width}x${manifest.mediaProbe.video.height}${
            manifest.mediaProbe.video.codecName ? ` ${manifest.mediaProbe.video.codecName}` : ""
          }`,
        ],
        ["Audio", audioProbeSummary(manifest.mediaProbe.audio)],
      ],
    ),
    "",
  );
  sections.push(
    "## Inputs",
    "",
    table(
      ["Input", "Digest", "Detail"],
      [
        [manifest.renderPlan.path, manifest.renderPlan.digest, "current render plan"],
        [
          manifest.voiceoverAudio.path,
          manifest.voiceoverAudio.digest,
          voiceoverReviewDetail(manifest),
        ],
      ],
    ),
    "",
    "## Timeline",
    "",
    table(
      ["Segment", "Scene", "Duration", "Asset", "Source frames"],
      manifest.timeline.map((item) => [
        item.segment ?? "scene",
        item.sceneIndex ? String(item.sceneIndex) : "-",
        `${item.durationSeconds}s`,
        item.backgroundAsset.path,
        item.sourceFrameAssets ? String(item.sourceFrameAssets.length) : "-",
      ]),
    ),
    "",
    "## Overlays",
    "",
    table(
      ["Role", "Placement", "Asset"],
      manifest.composition.overlays.map((overlay) => [
        overlay.role,
        overlay.placement,
        overlay.path,
      ]),
    ),
    "",
    "## Operator Checklist",
    "",
    bulletList(manifest.composition.reviewChecklist),
    "",
    "## Required Decision",
    "",
    "Review the MP4 locally. If it is not acceptable, revise upstream artifacts and regenerate the render. Upload remains disabled until a separate future upload approval exists.",
    "",
    ...renderDraftDecision(manifest),
  );
  return sections.join("\n");
}

/**
 * Builds the operator decision section for a draft render review.
 *
 * @param manifest - The draft render manifest.
 * @returns The markdown lines for the decision section.
 */
function renderDraftDecision(manifest: DraftRenderManifest): string[] {
  const timingDraftGate = manifest.voiceoverAudio.productionVoiceCandidate
    ? []
    : [
        "Confirm this MP4 used deterministic reference audio; treat it as a local timing draft, not final production voice.",
      ];
  const timingDraftNextStep = manifest.voiceoverAudio.productionVoiceCandidate
    ? []
    : [
        "Regenerate voiceover with reviewed local Piper audio before final production voice review.",
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
      "Revise the production package, render plan, voiceover, subtitles, or visual assets, then regenerate evidence/readiness and the draft render.",
      "Do not upload, schedule, or publish an unacceptable local draft.",
    ],
    blockedActions: [
      "Private upload remains disabled until a separate future upload approval and configuration exist.",
      "Scheduled/public publish remains disabled and requires a separate future risk review.",
      "Paid/generative media providers remain outside the deterministic local render path.",
    ],
  });
}

/**
 * Describes the voiceover review status.
 *
 * @param manifest - The draft render manifest.
 * @returns A detail string containing the voiceover mode, quality, and review label.
 */
function voiceoverReviewDetail(manifest: DraftRenderManifest): string {
  const candidateLabel = manifest.voiceoverAudio.productionVoiceCandidate
    ? "production voice candidate; operator listening still required"
    : "timing/reference only; local timing draft";
  return `${manifest.voiceoverAudio.mode}; ${manifest.voiceoverAudio.quality}; ${candidateLabel}`;
}

/**
 * Summarizes audio probe details.
 *
 * @param audio - The probed audio stream metadata.
 * @returns A summary string containing the codec name, optional sample rate, and optional channel count.
 */
function audioProbeSummary(audio: NonNullable<DraftRenderManifest["mediaProbe"]>["audio"]): string {
  const details = [audio.codecName, audio.sampleRateHz ? `${audio.sampleRateHz}Hz` : undefined]
    .filter((item): item is string => item !== undefined)
    .join(" ");
  const channels = audio.channels ? ` (${audio.channels} channels)` : "";
  return `${details || "audio stream"}${channels}`;
}
