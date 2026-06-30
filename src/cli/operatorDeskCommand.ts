import type { Command } from "commander";

type AsyncActionWrapper = <T extends unknown[]>(
  handler: (...args: T) => Promise<void>,
) => (...args: T) => void;

type DeskCommandOptions = {
  latest?: boolean;
  plain?: boolean;
  run?: string;
};

/**
 * Registers the local operator desk entry points.
 *
 * @param program - The Commander program to extend.
 * @param wrap - Wraps the command action for async error handling.
 */
export function registerOperatorDeskCommand(program: Command, wrap: AsyncActionWrapper): void {
  const runDesk = async (options: DeskCommandOptions = {}) => {
    const { runOperatorDesk } = await import("./operatorDeskRunner.js");
    await runOperatorDesk(options);
  };

  program
    .command("desk")
    .option("--run <run_id>", "Open the desk focused on a specific run.")
    .option("--latest", "Open the desk focused on the latest run.")
    .option("--plain", "Print a non-interactive operator desk summary.")
    .description("Open the local operator desk for run review and next safe actions.")
    .action(
      wrap(async (options: DeskCommandOptions) => {
        await runDesk(options);
      }),
    );

  program.action(
    wrap(async () => {
      await runDesk();
    }),
  );
}
