import { bulletList } from "../utils/markdown.js";
import { AssetProvenance, AssetRef, RenderPlan } from "./renderPlanSchemas.js";

export function renderContactSheet(plan: RenderPlan, provenance: AssetProvenance): string {
  return [
    "# Storyboard Contact Sheet",
    "",
    `Run: ${plan.runId}`,
    `Generated at: ${plan.createdAt}`,
    "",
    "> Review artifact only. This does not approve render execution, TTS, upload, or publish.",
    "",
    "## Render Plan Inputs",
    "",
    `- Production package manifest: ${plan.productionPackageManifestPath}`,
    `- Manifest digest: ${plan.productionPackageManifestDigest}`,
    `- Asset count: ${provenance.assets.length}`,
    "",
    ...renderBookends(plan),
    "## Asset Provenance",
    "",
    bulletList(
      provenance.assets.map(
        (asset) => `${asset.role}: ${asset.path} (${asset.digest.slice(0, 12)})`,
      ),
    ),
    "",
    "## Scenes",
    "",
    ...plan.scenes.map((scene) =>
      [
        `### Scene ${scene.sceneIndex}`,
        "",
        `- Duration: ${scene.durationSeconds}s`,
        `- Background: ${scene.backgroundAsset.path}`,
        `- Overlays: ${scene.overlayAssets.map((asset) => asset.path).join(", ")}`,
        `- Subtitle source: ${scene.subtitleSource}`,
        "",
        scene.visualPrompt,
        "",
        `Narration preview: ${scene.narrationPreview}`,
        "",
      ].join("\n"),
    ),
  ].join("\n");
}

function renderBookends(plan: RenderPlan): string[] {
  if (!plan.bookends) {
    return [];
  }
  return [
    "## Intro And Outro Bookends",
    "",
    `- Intro: ${plan.bookends.intro.asset.path} for ${plan.bookends.intro.durationSeconds}s`,
    ...frameBullets("Intro source frames", plan.bookends.intro.frameAssets),
    `- Outro: ${plan.bookends.outro.asset.path} for ${plan.bookends.outro.durationSeconds}s`,
    ...frameBullets("Outro source frames", plan.bookends.outro.frameAssets),
    "",
    "> These committed source assets are included in the local draft render timeline for review; they do not imply upload or publish approval.",
    "",
  ];
}

function frameBullets(label: string, frames: AssetRef[] | undefined): string[] {
  if (!frames || frames.length === 0) {
    return [];
  }
  return [`- ${label}: ${frames.length} committed frames`];
}
