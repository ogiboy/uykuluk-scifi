import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { revisePackageArtifact } from "../revisions/packageArtifactRevision.js";
import { reviseRender } from "../revisions/renderRevision.js";
import { reviseScript } from "../revisions/scriptRevision.js";

type ArtifactRevisionOptions = {
  artifact?: string;
  editor: string;
  file: string;
  json?: boolean;
  reason: string;
  run: string;
};

type RenderRevisionOptions = { json?: boolean; reason?: string; reviewedBy?: string; run: string };

type WrapRevisionAction = <T extends Record<string, unknown>>(
  handler: (options: T) => Promise<void>,
) => (options: T) => void;

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
    .option("--json", "Print the raw script revision JSON for automation.")
    .description("Replace script.md with durable before/after revision evidence.")
    .action(
      wrap(async (options: ArtifactRevisionOptions) => {
        const revision = await reviseScript({
          runId: options.run,
          content: await readFile(options.file, "utf8"),
          reason: options.reason,
          editor: options.editor,
        });
        if (options.json) {
          console.log(JSON.stringify(revision, null, 2));
          return;
        }
        console.log(`Script revision recorded: ${revision.revisionId}`);
        console.log("Script review and approval are required again.");
      }),
    );
  revise
    .command("package-artifact")
    .requiredOption("--run <run_id>")
    .requiredOption("--artifact <target>")
    .requiredOption("--file <path>")
    .requiredOption("--reason <reason>")
    .option("--editor <editor>", "Revision author.", "operator")
    .option("--json", "Print the raw package artifact revision JSON for automation.")
    .description(
      "Replace a generated production-package artifact with durable before/after revision evidence.",
    )
    .action(
      wrap(async (options: ArtifactRevisionOptions) => {
        const revision = await revisePackageArtifact({
          runId: options.run,
          artifactKey: options.artifact ?? "",
          content: await readFile(options.file, "utf8"),
          reason: options.reason,
          editor: options.editor,
        });
        if (options.json) {
          console.log(JSON.stringify(revision, null, 2));
          return;
        }
        console.log(`Package artifact revision recorded: ${revision.revisionId}`);
        console.log("Regenerate evidence/readiness before using downstream artifacts.");
      }),
    );
  revise
    .command("render")
    .requiredOption("--run <run_id>")
    .option("--reason <reason>", "Required only when current render evidence is invalid.")
    .option("--reviewed-by <name>", "Invalid-evidence recovery reviewer.")
    .option("--json", "Print the raw render revision JSON for automation.")
    .description(
      "Archive a non-accepted draft and invalidate its approval before a fresh local render.",
    )
    .action(
      wrap(async (options: RenderRevisionOptions) => {
        const revision = await reviseRender(options.run, {
          reason: options.reason,
          reviewedBy: options.reviewedBy,
        });
        if (options.json) {
          console.log(JSON.stringify(revision, null, 2));
          return;
        }
        console.log(`Render revision recorded: ${revision.revisionId}`);
        console.log("The rejected draft is archived and a fresh render approval is required.");
      }),
    );
}
