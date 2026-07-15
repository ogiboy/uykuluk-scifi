import { Command } from "commander";
import {
  decideVisuals,
  generateHostedVisuals,
  importManualVisual,
  prepareHostedVisualGenerationPlan,
  prepareStaticVisuals,
  regenerateRejectedStaticVisuals,
} from "../stages/visuals.js";
import {
  decisionStatus,
  hostedPlanPurpose,
  parseExplicitSceneIndexes,
  parseSceneIndexes,
  positiveSceneIndex,
  readRequiredVisualMutationExpectation,
  readVisualMutationExpectation,
  type VisualMutationCliOptions,
} from "./visualCommandInputs.js";

type Wrap = <T extends unknown[]>(handler: (...args: T) => Promise<void>) => (...args: T) => void;

/** Registers scene-visual preparation, import, and review commands. */
export function registerVisualCommands(program: Command, wrap: Wrap): void {
  const visuals = program
    .command("visuals")
    .description("Prepare, revise, and review scene-specific visual evidence.");

  visuals
    .command("plan-hosted")
    .requiredOption("--run <run_id>")
    .requiredOption("--scenes <list>")
    .option("--purpose <purpose>", "initial or regenerate-rejected", "initial")
    .option("--reviewed-by <operator>")
    .option("--reason <reason>")
    .option("--expected-manifest-digest <sha256>")
    .option("--expected-active-revisions-file <path>")
    .option("--json", "Print the persisted hosted generation plan JSON.")
    .description("Bind selected visual beats to one exact FLUX.2 Pro cost quote.")
    .action(
      wrap(
        async (options: {
          json?: boolean;
          expectedActiveRevisionsFile?: string;
          expectedManifestDigest?: string;
          purpose: string;
          reason?: string;
          reviewedBy?: string;
          run: string;
          scenes: string;
        }) => {
          const sceneIndexes = parseExplicitSceneIndexes(options.scenes);
          const purpose = hostedPlanPurpose(options.purpose);
          const expectation =
            purpose === "regenerate-rejected"
              ? await readRequiredVisualMutationExpectation(options)
              : {};
          const plan = await prepareHostedVisualGenerationPlan({
            ...expectation,
            runId: options.run,
            purpose,
            reason: options.reason,
            reviewedBy: options.reviewedBy,
            sceneIndexes,
          });
          console.log(
            options.json
              ? JSON.stringify(plan, null, 2)
              : `Prepared ${purpose} FLUX.2 Pro plan for ${sceneIndexes.length} scene(s).`,
          );
        },
      ),
    );

  visuals
    .command("generate-hosted")
    .requiredOption("--run <run_id>")
    .requiredOption("--binding-digest <sha256>")
    .requiredOption("--quote-digest <sha256>")
    .requiredOption("--approval-id <approval_id>")
    .requiredOption("--confirm-paid-operation")
    .option("--json", "Print the updated visual manifest JSON.")
    .description("Execute the exact approved FLUX.2 Pro plan and open results for review.")
    .action(
      wrap(
        async (options: {
          approvalId: string;
          bindingDigest: string;
          confirmPaidOperation: boolean;
          json?: boolean;
          quoteDigest: string;
          run: string;
        }) => {
          if (!options.confirmPaidOperation) {
            throw new Error("Hosted visual generation requires paid-operation confirmation.");
          }
          const manifest = await generateHostedVisuals({
            runId: options.run,
            confirmation: {
              approvalId: options.approvalId,
              bindingDigest: options.bindingDigest,
              quoteDigest: options.quoteDigest,
              confirmPaidOperation: true,
            },
          });
          console.log(
            options.json
              ? JSON.stringify(manifest, null, 2)
              : "Generated the approved hosted visual batch for review.",
          );
        },
      ),
    );

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
