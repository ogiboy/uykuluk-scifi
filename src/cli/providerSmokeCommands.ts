import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { SafeExitError } from "../core/errors.js";
import {
  elevenLabsDiagnosticSmokeRequestSchema,
  runElevenLabsDiagnosticSmoke,
} from "../stages/voice/elevenLabsDiagnosticSmoke.js";

type Wrap = <T extends Record<string, unknown>>(
  handler: (options: T) => Promise<void>,
) => (options: T) => void;

/** Registers explicit, diagnostic-only provider connectivity checks. */
export function registerProviderSmokeCommands(program: Command, wrap: Wrap): void {
  program
    .command("provider-smoke")
    .description("Run bounded provider diagnostics that cannot be used as episode media.")
    .command("elevenlabs")
    .requiredOption("--file <path>")
    .option("--json", "Print the diagnostic evidence JSON for automation.")
    .description("Verify Eleven v3 audio and timestamps using proven included credits only.")
    .action(
      wrap(async (options: { file: string; json?: boolean }) => {
        const request = elevenLabsDiagnosticSmokeRequestSchema.parse(
          await readJsonInput(options.file),
        );
        const evidence = await runElevenLabsDiagnosticSmoke(process.cwd(), request);
        console.log(
          options.json
            ? JSON.stringify(evidence, null, 2)
            : `ElevenLabs diagnostic completed: ${evidence.operationId}`,
        );
      }),
    );
}

async function readJsonInput(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    throw new SafeExitError("Could not read the ElevenLabs diagnostic JSON input file.");
  }
}
