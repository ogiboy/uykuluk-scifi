import type { Command } from "commander";
import { formatVoiceCandidatesConsole } from "../stages/voice/voiceCatalogConsole.js";
import { generateVoiceCandidates } from "../stages/voiceCandidates.js";

type Wrap = <T extends unknown[]>(handler: (...args: T) => Promise<void>) => (...args: T) => void;

export function registerVoiceCommands(program: Command, wrap: Wrap): void {
  program
    .command("voice-candidates")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the redacted voice candidate catalog JSON for automation.")
    .description("Fetch review-safe ElevenLabs voice candidates without synthesizing speech.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const catalog = await generateVoiceCandidates(options.run);
        console.log(
          options.json ? JSON.stringify(catalog, null, 2) : formatVoiceCandidatesConsole(catalog),
        );
      }),
    );
}
