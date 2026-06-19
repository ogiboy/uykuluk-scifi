import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { reviseScript } from "../revisions/scriptRevision";

type RevisionOptions = {
  run: string;
  file: string;
  reason: string;
  editor: string;
};

type WrapRevisionAction = (
  handler: (options: RevisionOptions) => Promise<void>,
) => (options: RevisionOptions) => void;

/**
 * Registers CLI commands for recording script revisions.
 *
 * Creates a `revise script` command that accepts required metadata (run ID, file path, and revision reason) plus an optional editor name, then records the script revision.
 *
 * @param wrap - A function that wraps async handlers for CLI action execution
 */
export function registerRevisionCommands(program: Command, wrap: WrapRevisionAction): void {
  const revise = program.command("revise").description("Record attributable artifact revisions.");
  revise
    .command("script")
    .requiredOption("--run <run_id>")
    .requiredOption("--file <path>")
    .requiredOption("--reason <reason>")
    .option("--editor <editor>", "Revision author.", "operator")
    .description("Replace script.md with durable before/after revision evidence.")
    .action(
      wrap(async (options) => {
        const revision = await reviseScript({
          runId: options.run,
          content: await readFile(options.file, "utf8"),
          reason: options.reason,
          editor: options.editor,
        });
        console.log(`Script revision recorded: ${revision.revisionId}`);
        console.log("Script review and approval are required again.");
      }),
    );
}
