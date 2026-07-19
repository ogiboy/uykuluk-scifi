import type { Command } from "commander";
import { readFile } from "node:fs/promises";
import { SafeExitError } from "../core/errors.js";
import {
  executeApprovedLocalModelOperation,
  prepareLocalModelOperation,
  readOverview,
} from "../localModels/localModelReadiness.js";
import { launchLocalModelWorker } from "../localModels/localModelWorker.js";
import {
  localModelExecuteRequestSchema,
  localModelPrepareRequestSchema,
} from "../studio/actionServiceRequestSchemas.js";

type Wrap = <T extends Record<string, unknown>>(
  handler: (options: T) => Promise<void>,
) => (options: T) => void;

type FileOptions = Readonly<{ file: string; json?: boolean }>;

/**
 * Registers the hidden `local-model` command group for inspecting readiness and operating the managed runtime.
 *
 * The `prepare` command persists cost, time, and disk preflight evidence for operator review. The `execute`
 * command queues only the exact approved operation and starts the local-model worker, while `overview`
 * reports the current readiness projection without starting runtime work.
 *
 * @param program - Commander program to which the `local-model` command group is added.
 */
export function registerLocalModelCommands(program: Command, wrap: Wrap): void {
  const localModel = program
    .command("local-model")
    .description("Inspect and operate the Studio-managed local model runtime.");

  localModel
    .command("overview")
    .option("--json", "Print the operator-safe local-model readiness projection.")
    .description("Read local-model readiness without starting downloads or inference.")
    .action(
      wrap(async (options: { json?: boolean }) => {
        const overview = await readOverview(process.cwd());
        console.log(
          options.json
            ? JSON.stringify(overview, null, 2)
            : `${overview.readiness}: ${overview.nextAction}`,
        );
      }),
    );

  localModel
    .command("prepare")
    .requiredOption("--file <path>")
    .option("--json", "Print the persisted preflight JSON.")
    .description("Persist the exact cost, time, and disk preflight for operator review.")
    .action(
      wrap(async (options: FileOptions) => {
        const input = localModelPrepareRequestSchema.parse(await readJsonInput(options.file));
        const preparation = await prepareLocalModelOperation(process.cwd(), input);
        console.log(
          options.json
            ? JSON.stringify(preparation, null, 2)
            : `Local-model preflight prepared: ${preparation.runId}`,
        );
      }),
    );

  localModel
    .command("execute")
    .requiredOption("--file <path>")
    .option("--json", "Print the queued operation JSON.")
    .description("Queue only an exact operator-approved local-model operation.")
    .action(
      wrap(async (options: FileOptions) => {
        const input = localModelExecuteRequestSchema.parse(await readJsonInput(options.file));
        const operation = await executeApprovedLocalModelOperation(process.cwd(), input);
        launchLocalModelWorker(process.cwd());
        console.log(
          options.json
            ? JSON.stringify({ operation, worker: { started: true } }, null, 2)
            : `Local-model operation queued and worker started: ${operation.operationId}`,
        );
      }),
    );
}

async function readJsonInput(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new SafeExitError(`Could not read the local-model JSON input${detail}`);
  }
}
