import { Command } from "commander";
import { approvePaidGenerationCost } from "../stages/approveCost.js";
import { approveIdea } from "../stages/approveIdea.js";
import { approveRender } from "../stages/approveRender.js";
import { approveScript } from "../stages/approveScript.js";

type AsyncActionWrapper = <T extends unknown[]>(
  handler: (...args: T) => Promise<void>,
) => (...args: T) => void;

/**
 * Registers CLI commands for recording explicit approvals.
 *
 * Registers three subcommands under `approve`: `idea`, `script`, and `cost`.
 *
 * @param program - The commander `Command` instance to register the approval commands on
 * @param wrap - An async action wrapper that adapts async handlers to synchronous callback signatures
 */
export function registerApprovalCommands(program: Command, wrap: AsyncActionWrapper): void {
  const approve = program.command("approve").description("Record explicit approvals.");

  approve
    .command("idea")
    .requiredOption("--run <run_id>")
    .requiredOption("--idea <idea_id>")
    .description("Approve one generated idea.")
    .action(
      wrap(async (options: { run: string; idea: string }) => {
        const approval = await approveIdea(options.run, options.idea);
        console.log(`Idea approval recorded: ${approval.approvalId}`);
      }),
    );

  approve
    .command("script")
    .requiredOption("--run <run_id>")
    .option("--acknowledge-warnings", "Confirm non-blocking script review warnings are accepted.")
    .description("Approve reviewed script.")
    .action(
      wrap(async (options: { run: string; acknowledgeWarnings?: boolean }) => {
        const approval = await approveScript(options.run, {
          acknowledgeWarnings: Boolean(options.acknowledgeWarnings),
        });
        console.log(`Script approval recorded: ${approval.approvalId}`);
      }),
    );

  approve
    .command("cost")
    .requiredOption("--run <run_id>")
    .description("Approve the exact persisted future paid-generation cost quote.")
    .action(
      wrap(async (options: { run: string }) => {
        const approval = await approvePaidGenerationCost(options.run);
        console.log(`Paid-generation cost approval recorded: ${approval.approvalId}`);
      }),
    );

  approve
    .command("render")
    .requiredOption("--run <run_id>")
    .description(
      "Approve the exact current render plan and voiceover audio for local draft render.",
    )
    .action(
      wrap(async (options: { run: string }) => {
        const approval = await approveRender(options.run);
        console.log(`Render approval recorded: ${approval.approvalId}`);
      }),
    );
}
