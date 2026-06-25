import { bulletList, table } from "../utils/markdown.js";
import type { DraftRenderManifest } from "./renderEvidence.js";

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
  if (manifest.mediaProbe) {
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
  }
  sections.push(
    "## Inputs",
    "",
    table(
      ["Input", "Digest"],
      [
        [manifest.renderPlan.path, manifest.renderPlan.digest],
        [manifest.voiceoverAudio.path, manifest.voiceoverAudio.digest],
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
  );
  return sections.join("\n");
}

function audioProbeSummary(audio: NonNullable<DraftRenderManifest["mediaProbe"]>["audio"]): string {
  const details = [audio.codecName, audio.sampleRateHz ? `${audio.sampleRateHz}Hz` : undefined]
    .filter((item): item is string => item !== undefined)
    .join(" ");
  const channels = audio.channels ? ` (${audio.channels} channels)` : "";
  return `${details || "audio stream"}${channels}`;
}
