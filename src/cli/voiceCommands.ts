import type { Command } from "commander";
import {
  formatVoiceCandidatesConsole,
  formatVoicePreviewConsole,
  formatVoiceSelectionConsole,
} from "../stages/voice/voiceCatalogConsole.js";
import { generateVoiceCandidates } from "../stages/voiceCandidates.js";
import { generateVoicePreview } from "../stages/voicePreview.js";
import { selectVoice } from "../stages/voiceSelection.js";

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

  program
    .command("voice-preview")
    .requiredOption("--run <run_id>")
    .requiredOption("--voice <voice_id>")
    .option("--json", "Print the redacted local preview evidence JSON for automation.")
    .description("Download one persisted candidate preview through the bounded provider boundary.")
    .action(
      wrap(async (options: { json?: boolean; run: string; voice: string }) => {
        const evidence = await generateVoicePreview(options.run, options.voice);
        console.log(
          options.json ? JSON.stringify(evidence, null, 2) : formatVoicePreviewConsole(evidence),
        );
      }),
    );

  program
    .command("voice-select")
    .requiredOption("--run <run_id>")
    .requiredOption("--voice <voice_id>")
    .requiredOption("--reviewed-by <operator>")
    .requiredOption("--notes <notes>")
    .option(
      "--confirm-production-rights",
      "Confirm that the operator has production usage rights for this paid-tier voice.",
    )
    .option("--json", "Print the exact persisted voice selection JSON for automation.")
    .description("Select an auditioned voice with operator attribution and exact evidence binding.")
    .action(
      wrap(
        async (options: {
          confirmProductionRights?: boolean;
          json?: boolean;
          notes: string;
          reviewedBy: string;
          run: string;
          voice: string;
        }) => {
          const selection = await selectVoice(options.run, {
            voiceId: options.voice,
            reviewedBy: options.reviewedBy,
            notes: options.notes,
            confirmProductionRights: options.confirmProductionRights ?? false,
          });
          console.log(
            options.json
              ? JSON.stringify(selection, null, 2)
              : formatVoiceSelectionConsole(selection),
          );
        },
      ),
    );
}
