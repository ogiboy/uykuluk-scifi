import { Command } from "commander";
import { approvePaidGenerationCost } from "../stages/approveCost";
import { approveIdea } from "../stages/approveIdea";
import { approveScript } from "../stages/approveScript";

type AsyncActionWrapper = <T extends unknown[]>(
  handler: (...args: T) => Promise<void>,
) => (...args: T) => void;

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
    .description("Approve reviewed script.")
    .action(
      wrap(async (options: { run: string }) => {
        const approval = await approveScript(options.run);
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
}
