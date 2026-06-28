import { Command } from "commander";
import { SafeExitError } from "../core/errors.js";
import { runLocalModelEval } from "../diagnostics/localModelEval.js";
import { formatLocalModelEvalConsole } from "../diagnostics/localModelEvalFormatting.js";

type Wrap = <T extends unknown[]>(handler: (...args: T) => Promise<void>) => (...args: T) => void;

/**
 * Registers local model evaluation commands.
 *
 * @param program - The Commander program to extend.
 * @param wrap - Wraps async command handlers for Commander.
 */
export function registerEvaluationCommands(program: Command, wrap: Wrap): void {
  const evalCommand = program.command("eval").description("Local evaluation commands.");
  evalCommand
    .command("local-model")
    .option("--json", "Print the raw local model evaluation JSON for automation.")
    .description("Evaluate the configured local LLM against small production parser contracts.")
    .action(
      wrap(async (options: { json?: boolean }) => {
        const report = await runLocalModelEval();
        console.log(
          options.json ? JSON.stringify(report, null, 2) : formatLocalModelEvalConsole(report),
        );
        if (!report.passed) {
          throw new SafeExitError("Local model eval blocked.", 1);
        }
      }),
    );
}
