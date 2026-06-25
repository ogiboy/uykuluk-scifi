import { Command } from "commander";
import { importAnalyticsFile, refreshSavedAnalyticsReport } from "../analytics/import.js";

type AsyncActionWrapper = <T extends unknown[]>(
  handler: (...args: T) => Promise<void>,
) => (...args: T) => void;

export function registerAnalyticsCommands(program: Command, wrap: AsyncActionWrapper): void {
  const analytics = program.command("analytics").description("Manual local analytics commands.");
  analytics
    .command("import")
    .requiredOption("--file <path>")
    .description("Import operator-provided YouTube performance CSV/JSON into local analytics.")
    .action(
      wrap(async (options: { file: string }) => {
        const result = await importAnalyticsFile(options.file);
        console.log(`Analytics imported. Records: ${result.recordCount}`);
        console.log(`Dataset: ${result.outputPath}`);
        console.log(`Report: ${result.reportPath}`);
      }),
    );

  analytics
    .command("report")
    .description("Refresh and print the current local manual analytics report.")
    .action(
      wrap(async () => {
        const result = await refreshSavedAnalyticsReport();
        console.log(result.report);
        console.log(`\nReport refreshed: ${result.reportPath}`);
      }),
    );
}
