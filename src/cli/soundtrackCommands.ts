import type { Command } from "commander";
import { readFile } from "node:fs/promises";
import { runLoudnormAnalysis } from "../stages/render/audioMasteringExecution.js";
import {
  analyzeSoundtrackLoudness,
  configureSoundtrackMix,
  decideSoundtrack,
  importSoundtrackAudio,
  prepareVoiceOnlySoundtrack,
} from "../stages/soundtrack/soundtrackService.js";
import {
  soundtrackAnalyzeRequestSchema,
  soundtrackConfigureRequestSchema,
  soundtrackDecisionRequestSchema,
  soundtrackImportRequestSchema,
  soundtrackPrepareRequestSchema,
} from "../studio/soundtrackActionRequestSchemas.js";

type Wrap = <T extends unknown[]>(handler: (...args: T) => Promise<void>) => (...args: T) => void;

type ExpectationOptions = Readonly<{
  expectedManifestDigest: string;
  expectedRevision: string;
  run: string;
}>;

/** Registers the approval-bound local soundtrack preparation, import, mix, analysis, and review commands. */
export function registerSoundtrackCommands(program: Command, wrap: Wrap): void {
  const soundtrack = program
    .command("soundtrack")
    .description("Prepare and review local soundtrack evidence.");

  soundtrack
    .command("prepare")
    .requiredOption("--run <run_id>")
    .option("--json")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const input = soundtrackPrepareRequestSchema.parse({ runId: options.run });
        const evidence = await prepareVoiceOnlySoundtrack(input);
        print(options.json, evidence, "Prepared voice-only soundtrack evidence for review.");
      }),
    );

  soundtrack
    .command("import")
    .requiredOption("--run <run_id>")
    .requiredOption("--asset <asset_id>")
    .requiredOption("--role <music_or_sfx>")
    .requiredOption("--file <path>")
    .requiredOption("--provenance-file <path>")
    .requiredOption("--expected-manifest-digest <sha256>")
    .requiredOption("--expected-revision <revision>")
    .option("--json")
    .action(
      wrap(
        async (
          options: ExpectationOptions & {
            asset: string;
            file: string;
            json?: boolean;
            provenanceFile: string;
            role: string;
          },
        ) => {
          const provenance = JSON.parse(await readFile(options.provenanceFile, "utf8")) as unknown;
          const input = soundtrackImportRequestSchema.parse({
            assetId: options.asset,
            contentBase64: "AAAA",
            ...expectation(options),
            provenance,
            role: options.role,
            runId: options.run,
            sourceFileName:
              provenance && typeof provenance === "object" && "originalFileName" in provenance
                ? (provenance as { originalFileName: unknown }).originalFileName
                : "invalid",
          });
          const evidence = await importSoundtrackAudio({
            ...expectation(options),
            runId: input.runId,
            assetId: input.assetId,
            role: input.role,
            sourcePath: options.file,
            provenance: input.provenance,
          });
          print(options.json, evidence, `Imported soundtrack asset ${input.assetId}.`);
        },
      ),
    );

  soundtrack
    .command("configure")
    .requiredOption("--run <run_id>")
    .requiredOption("--file <path>")
    .requiredOption("--expected-manifest-digest <sha256>")
    .requiredOption("--expected-revision <revision>")
    .option("--json")
    .action(
      wrap(async (options: ExpectationOptions & { file: string; json?: boolean }) => {
        const mix = JSON.parse(await readFile(options.file, "utf8")) as unknown;
        const input = soundtrackConfigureRequestSchema.parse({
          ...expectation(options),
          runId: options.run,
          ...(mix as object),
        });
        const evidence = await configureSoundtrackMix(input);
        print(
          options.json,
          evidence,
          "Configured soundtrack mix and invalidated previous analysis.",
        );
      }),
    );

  soundtrack
    .command("analyze")
    .requiredOption("--run <run_id>")
    .requiredOption("--expected-manifest-digest <sha256>")
    .requiredOption("--expected-revision <revision>")
    .option("--json")
    .action(
      wrap(async (options: ExpectationOptions & { json?: boolean }) => {
        const input = soundtrackAnalyzeRequestSchema.parse({
          ...expectation(options),
          runId: options.run,
        });
        const evidence = await analyzeSoundtrackLoudness({
          ...input,
          ffmpeg: async ({ args, timeoutMs }) => ({
            stderr: (await runLoudnormAnalysis("ffmpeg", args, timeoutMs)).stderr,
          }),
        });
        print(options.json, evidence, "Recorded deterministic FFmpeg loudness analysis.");
      }),
    );

  soundtrack
    .command("decide")
    .requiredOption("--run <run_id>")
    .requiredOption("--decision <approved_or_rejected>")
    .requiredOption("--reviewed-by <operator>")
    .requiredOption("--notes <notes>")
    .requiredOption("--expected-manifest-digest <sha256>")
    .requiredOption("--expected-revision <revision>")
    .option("--json")
    .action(
      wrap(
        async (
          options: ExpectationOptions & {
            decision: string;
            json?: boolean;
            notes: string;
            reviewedBy: string;
          },
        ) => {
          const input = soundtrackDecisionRequestSchema.parse({
            ...expectation(options),
            notes: options.notes,
            reviewedBy: options.reviewedBy,
            runId: options.run,
            status: options.decision,
          });
          const evidence = await decideSoundtrack(input);
          print(options.json, evidence, `Recorded soundtrack ${input.status} decision.`);
        },
      ),
    );
}

function expectation(options: ExpectationOptions) {
  return {
    expectedManifestDigest: options.expectedManifestDigest,
    expectedRevision: Number(options.expectedRevision),
  };
}

function print(json: boolean | undefined, value: unknown, message: string): void {
  console.log(json ? JSON.stringify(value, null, 2) : message);
}
