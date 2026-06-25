import { bulletList, table } from "../utils/markdown.js";
import type { DraftRenderManifest } from "./renderEvidence.js";

export function renderDraftReviewMarkdown(manifest: DraftRenderManifest): string {
  return [
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
      ["Segment", "Scene", "Duration", "Asset"],
      manifest.timeline.map((item) => [
        item.segment ?? "scene",
        item.sceneIndex ? String(item.sceneIndex) : "-",
        `${item.durationSeconds}s`,
        item.backgroundAsset.path,
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
  ].join("\n");
}
