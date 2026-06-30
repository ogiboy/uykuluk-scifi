import type { Command } from "commander";
import { formatRenderDraftConsole } from "../stages/renderConsole.js";
import { reviewDraftRender } from "../stages/reviewRender.js";
import {
  formatRenderDecisionReviewConsole,
  reviewRenderDecision,
} from "../stages/reviewRenderDecision.js";
import { formatRenderPlanReviewConsole, reviewRenderPlan } from "../stages/reviewRenderPlan.js";
import { reviewScript } from "../stages/reviewScript.js";
import { formatVoiceoverReviewConsole, reviewVoiceover } from "../stages/reviewVoiceover.js";

type ReviewOptions = {
  json?: boolean;
  run: string;
};

type WrapReviewAction = (
  handler: (options: ReviewOptions) => Promise<void>,
) => (options: ReviewOptions) => void;

/**
 * Registers read-only local review commands.
 *
 * @param program - The Commander program to extend.
 * @param wrap - Wraps command handlers for async error handling.
 */
export function registerReviewCommands(program: Command, wrap: WrapReviewAction): void {
  const review = program.command("review").description("Run local reviews.");
  review
    .command("render-plan")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw render-plan review handoff JSON for automation.")
    .description("Show the local render-plan and contact-sheet review handoff.")
    .action(
      wrap(async (options) => {
        const handoff = await reviewRenderPlan(options.run);
        console.log(
          options.json ? JSON.stringify(handoff, null, 2) : formatRenderPlanReviewConsole(handoff),
        );
      }),
    );
  review
    .command("voice")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw voiceover review handoff JSON for automation.")
    .description("Show the local voiceover review handoff.")
    .action(
      wrap(async (options) => {
        const handoff = await reviewVoiceover(options.run);
        console.log(
          options.json ? JSON.stringify(handoff, null, 2) : formatVoiceoverReviewConsole(handoff),
        );
      }),
    );
  review
    .command("script")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw script review JSON for automation.")
    .description("Review generated script.")
    .action(
      wrap(async (options) => {
        const result = await reviewScript(options.run);
        console.log(
          options.json
            ? JSON.stringify(result, null, 2)
            : `Script reviewed. Warnings: ${result.warnings.length}`,
        );
      }),
    );
  review
    .command("render")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw draft render manifest JSON for automation.")
    .description("Show the local draft render review handoff.")
    .action(
      wrap(async (options) => {
        const manifest = await reviewDraftRender(options.run);
        console.log(
          options.json ? JSON.stringify(manifest, null, 2) : formatRenderDraftConsole(manifest),
        );
      }),
    );
  review
    .command("render-decision")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw render-decision review handoff JSON for automation.")
    .description("Show the recorded local render-decision review handoff.")
    .action(
      wrap(async (options) => {
        const handoff = await reviewRenderDecision(options.run);
        console.log(
          options.json
            ? JSON.stringify(handoff, null, 2)
            : formatRenderDecisionReviewConsole(handoff),
        );
      }),
    );
}
