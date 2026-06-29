import type { Command } from "commander";
import {
  recordRenderDecision,
  renderDecisionValues,
  type RenderDecision,
} from "../stages/renderDecision.js";

type DecisionOptions = {
  decision: RenderDecision;
  json?: boolean;
  notes: string;
  reviewedBy: string;
  run: string;
};

type WrapDecisionAction = (
  handler: (options: DecisionOptions) => Promise<void>,
) => (options: DecisionOptions) => void;

/**
 * Registers the `decide render` CLI command.
 *
 * @param program - The Commander program to extend.
 * @param wrap - Wraps the command handler for async error handling.
 */
export function registerDecisionCommands(program: Command, wrap: WrapDecisionAction): void {
  const decide = program.command("decide").description("Record durable operator decisions.");
  decide
    .command("render")
    .requiredOption("--run <run_id>")
    .requiredOption("--decision <decision>", `Decision: ${renderDecisionValues.join(", ")}.`)
    .requiredOption("--notes <notes>")
    .option("--reviewed-by <name>", "Decision reviewer.", "operator")
    .option("--json", "Print the raw render decision JSON for automation.")
    .description("Record the operator decision after local draft-render review.")
    .action(
      wrap(async (options) => {
        const record = await recordRenderDecision({
          decision: options.decision,
          notes: options.notes,
          reviewedBy: options.reviewedBy,
          runId: options.run,
        });
        if (options.json) {
          console.log(JSON.stringify(record, null, 2));
          return;
        }
        console.log(`Render decision recorded: ${record.decision}`);
        console.log("Decision artifact: production/render/render_decision.md");
        console.log("Upload and publish remain disabled.");
      }),
    );
}
