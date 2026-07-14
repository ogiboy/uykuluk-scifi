import { Command } from "commander";
import { readFile } from "node:fs/promises";
import {
  decideVisuals,
  importManualVisual,
  prepareStaticVisuals,
  regenerateRejectedStaticVisuals,
  type VisualMutationExpectation,
} from "../stages/visuals.js";
import {
  visualActiveRevisionExpectationsSchema,
  visualMutationExpectationSchema,
} from "../stages/visuals/visualMutationExpectation.js";

type Wrap = <T extends unknown[]>(handler: (...args: T) => Promise<void>) => (...args: T) => void;

/** Registers scene-visual preparation, import, and review commands. */
export function registerVisualCommands(program: Command, wrap: Wrap): void {
  const visuals = program
    .command("visuals")
    .description("Prepare, revise, and review scene-specific visual evidence.");

  visuals
    .command("prepare")
    .requiredOption("--run <run_id>")
    .option("--json", "Print the persisted visual manifest JSON.")
    .description("Prepare deterministic static fallback visuals for every production scene.")
    .action(
      wrap(async (options: { json?: boolean; run: string }) => {
        const manifest = await prepareStaticVisuals(options.run);
        console.log(
          options.json
            ? JSON.stringify(manifest, null, 2)
            : `Prepared ${manifest.scenes.length} scene visuals for review.`,
        );
      }),
    );

  visuals
    .command("import")
    .requiredOption("--run <run_id>")
    .requiredOption("--scene <number>")
    .requiredOption("--file <path>")
    .requiredOption("--expected-manifest-digest <sha256>")
    .requiredOption("--expected-active-revisions-file <path>")
    .option("--json", "Print the updated visual manifest JSON.")
    .description("Import a local PNG/JPEG as the next revision for one scene.")
    .action(
      wrap(async (options: VisualMutationCliOptions & { file: string; scene: string }) => {
        const manifest = await importManualVisual({
          runId: options.run,
          sceneIndex: positiveSceneIndex(options.scene),
          sourcePath: options.file,
          ...(await readVisualMutationExpectation(options)),
        });
        console.log(
          options.json
            ? JSON.stringify(manifest, null, 2)
            : `Imported a new visual revision for scene ${options.scene}.`,
        );
      }),
    );

  visuals
    .command("decide")
    .requiredOption("--run <run_id>")
    .requiredOption("--scenes <all_or_list>")
    .requiredOption("--decision <approved_or_rejected>")
    .requiredOption("--reviewed-by <operator>")
    .requiredOption("--notes <notes>")
    .requiredOption("--expected-manifest-digest <sha256>")
    .requiredOption("--expected-active-revisions-file <path>")
    .option("--json", "Print the updated visual manifest JSON.")
    .description("Approve or reject active scene revisions with operator attribution.")
    .action(
      wrap(
        async (
          options: VisualMutationCliOptions & {
            decision: string;
            notes: string;
            reviewedBy: string;
            scenes: string;
          },
        ) => {
          const expectation = await readVisualMutationExpectation(options);
          const sceneIndexes = parseSceneIndexes(
            options.scenes,
            expectation.expectedActiveRevisions,
          );
          const status = decisionStatus(options.decision);
          const updated = await decideVisuals({
            runId: options.run,
            sceneIndexes,
            status,
            reviewedBy: options.reviewedBy,
            notes: options.notes,
            ...expectation,
          });
          console.log(
            options.json
              ? JSON.stringify(updated, null, 2)
              : `Recorded ${status} for ${sceneIndexes.length} visual scene(s).`,
          );
        },
      ),
    );

  visuals
    .command("regenerate")
    .requiredOption("--run <run_id>")
    .requiredOption("--scenes <list>")
    .requiredOption("--expected-manifest-digest <sha256>")
    .requiredOption("--expected-active-revisions-file <path>")
    .option("--json", "Print the updated visual manifest JSON.")
    .description("Regenerate rejected scenes as deterministic static next revisions.")
    .action(
      wrap(async (options: VisualMutationCliOptions & { scenes: string }) => {
        const expectation = await readVisualMutationExpectation(options);
        const sceneIndexes = parseSceneIndexes(options.scenes, expectation.expectedActiveRevisions);
        const updated = await regenerateRejectedStaticVisuals({
          runId: options.run,
          sceneIndexes,
          ...expectation,
        });
        console.log(
          options.json
            ? JSON.stringify(updated, null, 2)
            : `Regenerated ${sceneIndexes.length} rejected visual scene(s).`,
        );
      }),
    );
}

type VisualMutationCliOptions = Readonly<{
  expectedActiveRevisionsFile: string;
  expectedManifestDigest: string;
  json?: boolean;
  run: string;
}>;

async function readVisualMutationExpectation(
  options: VisualMutationCliOptions,
): Promise<VisualMutationExpectation> {
  const expectedActiveRevisions = visualActiveRevisionExpectationsSchema.parse(
    JSON.parse(await readFile(options.expectedActiveRevisionsFile, "utf8")) as unknown,
  );
  return visualMutationExpectationSchema.parse({
    expectedManifestDigest: options.expectedManifestDigest,
    expectedActiveRevisions,
  });
}

function positiveSceneIndex(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Scene index must be a positive integer.");
  }
  return parsed;
}

function parseSceneIndexes(value: string, scenes: ReadonlyArray<{ sceneIndex: number }>): number[] {
  if (value.trim().toLowerCase() === "all") {
    return scenes.map((scene) => scene.sceneIndex);
  }
  return Array.from(new Set(value.split(",").map((item) => positiveSceneIndex(item.trim()))));
}

function decisionStatus(value: string): "approved" | "rejected" {
  if (value === "approved" || value === "rejected") {
    return value;
  }
  throw new Error("Visual decision must be approved or rejected.");
}
