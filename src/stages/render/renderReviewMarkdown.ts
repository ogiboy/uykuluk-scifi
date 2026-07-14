import { bulletList, table } from "../../utils/markdown.js";
import type { DraftRenderManifest } from "../renderEvidence.js";
import { decisionCommandSection, renderDraftDecision } from "./renderReviewDecisionSection.js";
import { renderTimestampedReviewMap } from "./renderReviewTimelineMap.js";

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
        ["YouTube chapter draft", manifest.chapterDraft.markdownPath],
      ],
    ),
    "",
    "## Timing Alignment",
    "",
    table(
      ["Window", "Duration / scale"],
      [
        ["Intro", `${manifest.timing.introDurationSeconds}s`],
        ["Voiceover-backed scenes", `${manifest.timing.sceneAudioDurationSeconds}s`],
        ["Outro", `${manifest.timing.outroDurationSeconds}s`],
        ["Complete draft", `${manifest.timing.totalDurationSeconds}s`],
        ["Subtitle mode", manifest.subtitleTiming.timingMode],
        ["Source SRT", `${manifest.subtitleTiming.sourceDurationSeconds}s`],
        ["Subtitle clock scale", String(manifest.subtitleTiming.timeScale)],
      ],
    ),
    "",
    subtitleTimingReviewNote(manifest),
    "",
  ];
  sections.push(
    "## FFmpeg Review Command",
    "",
    "> Operator review command only. The actual render used an atomic temporary output before moving the validated MP4 into place.",
    "",
    "```bash",
    manifest.ffmpeg.reviewCommand,
    "```",
    "",
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
    "## Render Approval",
    "",
    table(
      ["Approval", "Value"],
      [
        ["Approval ID", manifest.renderApproval.approvalId],
        ["Approved ref", manifest.renderApproval.approvedRef],
      ],
    ),
    "",
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
        [manifest.subtitles.path, manifest.subtitles.sha256, manifest.subtitles.timingMode],
        [
          manifest.subtitles.metadataPath,
          manifest.subtitles.metadataSha256,
          "validated subtitle timing evidence",
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
    ...renderTimestampedReviewMap(manifest),
    "## YouTube Chapter Draft",
    "",
    table(
      ["Artifact", "SHA-256"],
      [
        [manifest.chapterDraft.jsonPath, manifest.chapterDraft.jsonSha256],
        [manifest.chapterDraft.markdownPath, manifest.chapterDraft.markdownSha256],
      ],
    ),
    "",
    "Review the chapter draft locally before copying it into any future upload workflow. It does not approve upload or publish.",
    "",
    ...frameCadenceSection(manifest),
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
    `Review the MP4 locally. If it is not acceptable, record a non-accepted decision and run \`pnpm producer revise render --run ${manifest.runId}\` before obtaining a fresh render approval. Upload remains disabled until a separate future upload approval exists.`,
    "",
    ...decisionCommandSection(manifest),
    ...renderDraftDecision(manifest),
  );
  return sections.join("\n");
}

function subtitleTimingReviewNote(manifest: DraftRenderManifest): string {
  if (manifest.subtitleTiming.timingMode === "elevenlabs-character-aligned") {
    return "The renderer burns the validated ElevenLabs original-alignment SRT on its exact provider timeline. Confirm Turkish wording, cue rhythm, and synchronization by listening and watching; intro/outro remain outside the subtitle window.";
  }
  return "The renderer linearly maps the production-package SRT clock onto the validated local voiceover window. Confirm synchronization by listening and watching; intro/outro remain outside the subtitle window.";
}

/**
 * Builds the source-frame cadence section for reviewable draft renders.
 *
 * @param manifest - The draft render manifest to inspect.
 * @returns Markdown lines for source-frame cadence, or an empty array when no frame inputs exist.
 */
function frameCadenceSection(manifest: DraftRenderManifest): string[] {
  const rows = manifest.ffmpegTimelineInputs
    .filter((input) => input.source === "source-frame")
    .map((input) => [
      input.segment,
      input.sceneIndex ? String(input.sceneIndex) : "-",
      input.frameIndex ? String(input.frameIndex) : "-",
      `${input.durationSeconds}s`,
      input.asset.path,
    ]);
  if (rows.length === 0) {
    return [];
  }
  return [
    "## Source Frame Cadence",
    "",
    table(["Segment", "Scene", "Frame", "Duration", "Asset"], rows),
    "",
  ];
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
