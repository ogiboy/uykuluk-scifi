import { Command } from "commander";
import { createChannelHandoff } from "../stages/channelHandoff.js";
import { channelHandoffMarkdownPath } from "../stages/channelHandoffContracts.js";
import { estimateCost } from "../stages/estimate.js";
import { generateEvidenceBundle } from "../stages/evidence.js";
import { createFinalReviewBundle } from "../stages/finalReviewBundle.js";
import { finalReviewBundleMarkdownPath } from "../stages/finalReviewBundleContracts.js";
import { runIdeas } from "../stages/ideas.js";
import { generateProductionPackage } from "../stages/productionPackage.js";
import { generateRenderPlan } from "../stages/renderPlan.js";
import { renderPlanArtifactPaths, type RenderPlan } from "../stages/renderPlanSchemas.js";
import { generateScript } from "../stages/script.js";

type Wrap = <T extends unknown[]>(handler: (...args: T) => Promise<void>) => (...args: T) => void;

export function registerGenerationCommands(program: Command, wrap: Wrap): void {
  program
    .command("ideas")
    .option("--json", "Print the raw generated ideas JSON for automation.")
    .description("Generate Turkish UykulukSciFi video ideas.")
    .action(
      wrap(async (options: { json?: boolean }) => {
        const result = await runIdeas();
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(`Run created: ${result.runId}`);
        console.log(`Ideas generated: ${result.ideas.map((idea) => idea.id).join(", ")}`);
      }),
    );

  program
    .command("script")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw script metadata JSON for automation.")
    .description("Generate script for an approved idea.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const meta = await generateScript(options.run);
        console.log(
          options.json
            ? JSON.stringify(meta, null, 2)
            : `Script generated. Words: ${meta.wordCount}`,
        );
      }),
    );

  program
    .command("package")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw production package manifest JSON for automation.")
    .description("Generate voiceover, subtitles, scenes, and YouTube metadata drafts.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const manifest = await generateProductionPackage(options.run);
        console.log(
          options.json ? JSON.stringify(manifest, null, 2) : "Production package generated.",
        );
      }),
    );

  program
    .command("estimate")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw cost estimate JSON for automation.")
    .description("Estimate next-step costs.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const estimate = await estimateCost(options.run);
        console.log(options.json ? JSON.stringify(estimate, null, 2) : "Cost estimate generated.");
      }),
    );

  program
    .command("render-plan")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw render plan JSON for automation.")
    .description("Generate a deterministic render plan and storyboard contact sheet.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const plan = await generateRenderPlan(options.run);
        console.log(
          options.json ? JSON.stringify(plan, null, 2) : formatRenderPlanGeneratedConsole(plan),
        );
      }),
    );

  program
    .command("evidence")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw evidence bundle JSON for automation.")
    .description("Generate evidence bundle.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const bundle = await generateEvidenceBundle(options.run);
        console.log(options.json ? JSON.stringify(bundle, null, 2) : "Evidence bundle generated.");
      }),
    );

  program
    .command("review-bundle")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw local final review bundle JSON for automation.")
    .description("Create a local final review handoff bundle for a rendered draft.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const bundle = await createFinalReviewBundle(options.run);
        console.log(
          options.json ? JSON.stringify(bundle, null, 2) : formatFinalReviewBundleConsole(bundle),
        );
      }),
    );

  program
    .command("channel-handoff")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw manual channel handoff JSON for automation.")
    .description("Create a local manual channel handoff package after accepted final review.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const handoff = await createChannelHandoff(options.run);
        console.log(
          options.json ? JSON.stringify(handoff, null, 2) : formatChannelHandoffConsole(handoff),
        );
      }),
    );
}

/**
 * Formats the post-generation render-plan handoff for CLI operators.
 *
 * @param plan - The generated render plan.
 * @returns Operator-readable output that points at the read-only review command.
 */
function formatRenderPlanGeneratedConsole(plan: RenderPlan): string {
  const [, contactSheetPath, assetProvenancePath] = renderPlanArtifactPaths;
  return [
    "Render plan generated.",
    `Scenes: ${plan.scenes.length}`,
    `Contact sheet: ${contactSheetPath}`,
    `Asset provenance: ${assetProvenancePath}`,
    `Next safe action: pnpm producer review render-plan --run ${plan.runId}`,
  ].join("\n");
}

function formatFinalReviewBundleConsole(
  bundle: Awaited<ReturnType<typeof createFinalReviewBundle>>,
): string {
  return [
    "Local final review bundle generated.",
    `Status: ${bundle.status}`,
    `Bundle: ${finalReviewBundleMarkdownPath}`,
    `Draft render: ${bundle.draftRender.path}`,
    `Next safe action: ${bundle.nextSafeAction}`,
    "Upload and publish remain disabled.",
  ].join("\n");
}

function formatChannelHandoffConsole(
  handoff: Awaited<ReturnType<typeof createChannelHandoff>>,
): string {
  return [
    "Manual channel handoff package generated.",
    `Status: ${handoff.status}`,
    `Package: ${channelHandoffMarkdownPath}`,
    `Draft render: ${handoff.media.draftRenderPath}`,
    `Subtitles: ${handoff.media.subtitlesPath}`,
    `Chapters: ${handoff.media.chaptersPath}`,
    `Thumbnails: ${handoff.thumbnailCandidates.markdownPath}`,
    `Metadata: ${handoff.youtube.metadataPath}`,
    `Title: ${handoff.youtube.title}`,
    `Next safe action: ${handoff.nextSafeAction}`,
    "Upload and publish remain disabled.",
  ].join("\n");
}
