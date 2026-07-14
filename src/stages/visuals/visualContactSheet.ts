import { table } from "../../utils/markdown.js";
import type { VisualManifest } from "./visualContracts.js";

/** Builds the operator-facing visual contact sheet from the canonical manifest. */
export function renderVisualContactSheet(manifest: VisualManifest): string {
  return [
    "# Scene Visual Contact Sheet",
    "",
    `Run: ${manifest.runId}`,
    `Updated at: ${manifest.updatedAt}`,
    `Production package: ${manifest.productionPackage.digest}`,
    "",
    "> Review artifact only. Render planning remains blocked until every active scene revision is approved.",
    "",
    table(
      [
        "Visual",
        "Production scenes",
        "Duration",
        "Revision",
        "Provider",
        "Decision",
        "Asset",
        "Motion",
      ],
      manifest.scenes.map((scene) => {
        const active = activeVisualRevision(scene);
        return [
          String(scene.sceneIndex),
          scene.productionSceneIndexes.join(", "),
          `${scene.durationSeconds}s`,
          String(scene.activeRevision),
          active.provider,
          scene.decision?.status ?? "pending",
          active.asset.path,
          active.motion.kind,
        ];
      }),
    ),
    "",
    ...manifest.scenes.flatMap((scene) => {
      const active = activeVisualRevision(scene);
      return [
        `## Scene ${scene.sceneIndex}`,
        "",
        `- Active revision: ${scene.activeRevision}`,
        `- Production scenes: ${scene.productionSceneIndexes.join(", ")}`,
        `- Duration: ${scene.durationSeconds}s`,
        `- Provider: ${active.provider}`,
        `- Asset: ${active.asset.path}`,
        `- Asset digest: ${active.asset.digest}`,
        `- Motion: ${active.motion.kind} (${active.motion.pan}, ${active.motion.zoomStart}→${active.motion.zoomEnd})`,
        `- Decision: ${scene.decision?.status ?? "pending"}`,
        "",
        scene.visualPrompt,
        "",
      ];
    }),
  ].join("\n");
}

function activeVisualRevision(scene: VisualManifest["scenes"][number]) {
  const revision = scene.revisions.find((item) => item.revision === scene.activeRevision);
  if (!revision) {
    throw new Error(`Scene ${scene.sceneIndex} is missing its active visual revision.`);
  }
  return revision;
}
