import { bulletList } from "../utils/markdown.js";
import { AssetProvenance, RenderPlan } from "./renderPlanSchemas.js";

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
