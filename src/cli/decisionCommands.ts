import type { Command } from "commander";
import {
  channelHandoffDecisionValues,
  recordChannelHandoffDecision,
  type ChannelHandoffDecision,
} from "../stages/channelHandoffDecision.js";
import {
  recordRenderDecision,
  renderDecisionValues,
  type RenderDecision,
} from "../stages/renderDecision.js";

type RenderDecisionOptions = {
  decision: RenderDecision;
  json?: boolean;
  notes: string;
  reviewedBy: string;
  run: string;
};

type ChannelHandoffDecisionOptions = {
  decision: ChannelHandoffDecision;
  json?: boolean;
  notes: string;
  reviewedBy: string;
  run: string;
  thumbnailCandidate?: string;
};

type WrapDecisionAction = <T extends Record<string, unknown>>(
  handler: (options: T) => Promise<void>,
) => (options: T) => void;

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
      wrap(async (options: RenderDecisionOptions) => {
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
        console.log(`Next safe action: ${record.nextSafeAction}`);
        console.log("Upload and publish remain disabled.");
      }),
    );

  decide
    .command("channel-handoff")
    .requiredOption("--run <run_id>")
    .requiredOption(
      "--decision <decision>",
      `Decision: ${channelHandoffDecisionValues.join(", ")}.`,
    )
    .option("--thumbnail-candidate <candidate_id>", "Required for accepted channel-prep decisions.")
    .requiredOption("--notes <notes>")
    .option("--reviewed-by <name>", "Decision reviewer.", "operator")
    .option("--json", "Print the raw channel handoff decision JSON for automation.")
    .description("Record the operator decision after manual channel handoff review.")
    .action(
      wrap(async (options: ChannelHandoffDecisionOptions) => {
        const record = await recordChannelHandoffDecision({
          decision: options.decision,
          notes: options.notes,
          reviewedBy: options.reviewedBy,
          runId: options.run,
          thumbnailCandidateId: options.thumbnailCandidate,
        });
        if (options.json) {
          console.log(JSON.stringify(record, null, 2));
          return;
        }
        console.log(`Channel handoff decision recorded: ${record.decision}`);
        console.log("Decision artifact: production/channel_handoff_decision.md");
        if (record.selectedThumbnailCandidate) {
          console.log(`Thumbnail: ${record.selectedThumbnailCandidate.candidateId}`);
        }
        console.log(`Next safe action: ${record.nextSafeAction}`);
        console.log("Upload and publish remain disabled.");
      }),
    );
}
