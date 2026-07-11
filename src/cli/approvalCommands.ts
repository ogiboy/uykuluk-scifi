import { Command } from "commander";
import type { ApprovalRecord } from "../core/state.js";
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
 * Registers four subcommands under `approve`: `idea`, `script`, `cost`, and `render`.
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
    .option("--json", "Print the raw approval record JSON for automation.")
    .description("Approve one generated idea.")
    .action(
      wrap(async (options: { json?: boolean; run: string; idea: string }) => {
        const approval = await approveIdea(options.run, options.idea);
        printApproval(approval, options.json, "Idea");
      }),
    );

  approve
    .command("script")
    .requiredOption("--run <run_id>")
    .option("--acknowledge-warnings", "Confirm non-blocking script review warnings are accepted.")
    .option("--json", "Print the raw approval record JSON for automation.")
    .description("Approve reviewed script.")
    .action(
      wrap(async (options: { acknowledgeWarnings?: boolean; json?: boolean; run: string }) => {
        const approval = await approveScript(options.run, {
          acknowledgeWarnings: Boolean(options.acknowledgeWarnings),
        });
        printApproval(approval, options.json, "Script");
      }),
    );

  approve
    .command("cost")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the raw approval record JSON for automation.")
    .description("Approve the exact persisted future paid-generation cost quote.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const approval = await approvePaidGenerationCost(options.run);
        printApproval(approval, options.json, "Paid-generation cost");
      }),
    );

  approve
    .command("render")
    .requiredOption("--run <run_id>")
    .description(
      "Approve the exact current render plan and voiceover audio for local draft render.",
    )
    .option("--json", "Print the raw approval record JSON for automation.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const approval = await approveRender(options.run);
        printApproval(approval, options.json, "Render");
      }),
    );
}

function printApproval(approval: ApprovalRecord, json: boolean | undefined, label: string): void {
  console.log(
    json ? JSON.stringify(approval, null, 2) : `${label} approval recorded: ${approval.approvalId}`,
  );
}
