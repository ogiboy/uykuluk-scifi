import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { SafeExitError } from "../core/errors.js";
import {
  promptProfileDigest,
  selectPromptProfile,
} from "../prompts/profiles/promptProfileStore.js";
import { readCurrentSettings, saveSettingsRevision } from "../settings/settingsRevisionStore.js";
import { episodeCreationRequestSchema } from "../stages/episode/episodeSnapshotContracts.js";
import { runIdeas } from "../stages/ideas.js";
import {
  promptProfileSaveRequestSchema,
  settingsSaveRequestSchema,
} from "../studio/actionServiceRequestContracts.js";

type Wrap = <T extends Record<string, unknown>>(
  handler: (options: T) => Promise<void>,
) => (options: T) => void;

type FileCommandOptions = Readonly<{ file: string; json?: boolean }>;

/** Registers revisioned settings, prompt-profile, and episode-brief CLI commands. */
export function registerSettingsCommands(program: Command, wrap: Wrap): void {
  program
    .command("settings")
    .description("Read and save revisioned producer settings.")
    .command("save")
    .requiredOption("--file <path>")
    .option("--json", "Print the saved settings revision JSON for automation.")
    .description("Save one attributed producer.config.json revision from a validated JSON request.")
    .action(
      wrap(async (options: FileCommandOptions) => {
        const input = settingsSaveRequestSchema.parse(await readJsonInput(options.file));
        const current = await readCurrentSettings(process.cwd());
        if (current.digest !== input.expectedCurrentDigest) {
          throw new SafeExitError(
            "Settings changed before this save could be applied; reload and review the current config.",
          );
        }
        const revision = await saveSettingsRevision({
          config: {
            ...current.config,
            studio: input.settings.studio,
            providers: {
              ...current.config.providers,
              llm: input.settings.providers.llm,
              tts: input.settings.providers.tts,
              imageGeneration: input.settings.providers.imageGeneration,
            },
            budgets: input.settings.budgets,
          },
          editor: input.editor,
          expectedCurrentDigest: input.expectedCurrentDigest,
          note: input.note,
          projectRoot: process.cwd(),
        });
        console.log(
          options.json
            ? JSON.stringify(revision, null, 2)
            : `Settings revision saved: ${revision.revisionId}`,
        );
      }),
    );

  program
    .command("prompt-profiles")
    .description("Manage persistent episode prompt profiles.")
    .command("save")
    .requiredOption("--file <path>")
    .option("--json", "Print the saved settings revision JSON for automation.")
    .description("Save one profile through the same revisioned producer settings contract.")
    .action(
      wrap(async (options: FileCommandOptions) => {
        const input = promptProfileSaveRequestSchema.parse(await readJsonInput(options.file));
        const current = await readCurrentSettings(process.cwd());
        if (current.digest !== input.expectedCurrentDigest) {
          throw new SafeExitError(
            "Settings changed before this prompt profile could be saved; reload and review the current config.",
          );
        }
        const currentProfile = selectPromptProfile(
          input.profile.id,
          current.config.editorial.profiles,
        );
        if (promptProfileDigest(currentProfile) !== input.expectedProfileDigest) {
          throw new SafeExitError(
            "Prompt profile changed before this save could be applied; reload and review the current profile.",
          );
        }
        const profiles = current.config.editorial.profiles.map((profile) =>
          profile.id === input.profile.id ? input.profile : profile,
        );
        const revision = await saveSettingsRevision({
          config: {
            ...current.config,
            editorial: {
              ...current.config.editorial,
              activeProfileId: input.makeActive
                ? input.profile.id
                : current.config.editorial.activeProfileId,
              profiles,
            },
          },
          editor: input.editor,
          expectedCurrentDigest: input.expectedCurrentDigest,
          note: input.note,
          projectRoot: process.cwd(),
        });
        console.log(
          options.json
            ? JSON.stringify(revision, null, 2)
            : `Prompt profile saved in settings revision: ${revision.revisionId}`,
        );
      }),
    );

  program
    .command("episodes")
    .description("Create Studio-first episode work from immutable brief snapshots.")
    .command("create")
    .requiredOption("--file <path>")
    .option("--json", "Print the generated episode ideas JSON for automation.")
    .description("Create an idea run from one exact profile and optional operator brief.")
    .action(
      wrap(async (options: FileCommandOptions) => {
        const result = await runIdeas(
          episodeCreationRequestSchema.parse(await readJsonInput(options.file)),
        );
        console.log(
          options.json ? JSON.stringify(result, null, 2) : `Episode run created: ${result.runId}`,
        );
      }),
    );
}

async function readJsonInput(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new SafeExitError(`Could not read the JSON input file${detail}`);
  }
}
