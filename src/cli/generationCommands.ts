import { Command } from "commander";
import { estimateCost } from "../stages/estimate.js";
import { generateEvidenceBundle } from "../stages/evidence.js";
import { runIdeas } from "../stages/ideas.js";
import { generateProductionPackage } from "../stages/productionPackage.js";
import { generateRenderPlan } from "../stages/renderPlan.js";
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
        console.log(options.json ? JSON.stringify(plan, null, 2) : "Render plan generated.");
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
}
