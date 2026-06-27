import { Command } from "commander";
import { importAnalyticsFile, refreshSavedAnalyticsReport } from "../analytics/import.js";

type AsyncActionWrapper = <T extends unknown[]>(
  handler: (...args: T) => Promise<void>,
) => (...args: T) => void;

/**
 * Registers the local analytics CLI commands.
 *
 * @param program - The Commander program to extend
 * @param wrap - Wraps async command handlers for Commander
 */
export function registerAnalyticsCommands(program: Command, wrap: AsyncActionWrapper): void {
  const analytics = program.command("analytics").description("Manual local analytics commands.");
  analytics
    .command("import")
    .requiredOption("--file <path>")
    .option("--json", "Print the raw analytics import result JSON for automation.")
    .description("Import operator-provided YouTube performance CSV/JSON into local analytics.")
    .action(
      wrap(async (options: { file: string; json?: boolean }) => {
        const result = await importAnalyticsFile(options.file);
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(`Analytics imported. Records: ${result.recordCount}`);
        console.log(`Dataset: ${result.outputPath}`);
        console.log(`Report: ${result.reportPath}`);
      }),
    );

  analytics
    .command("report")
    .option("--json", "Print the raw analytics report refresh result JSON for automation.")
    .description("Refresh and print the current local manual analytics report.")
    .action(
      wrap(async (options: { json?: boolean }) => {
        const result = await refreshSavedAnalyticsReport();
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(result.report);
        console.log(`\nReport refreshed: ${result.reportPath}`);
      }),
    );
}
