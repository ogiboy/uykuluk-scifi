import { Command } from "commander";
import { loadConfigSnapshot } from "../config/config.js";
import { SafeExitError } from "../core/errors.js";
import { createMfluxVisualGenerationBoundary } from "../localModels/mfluxVisualGenerationBoundary.js";
import {
  activateVisualRevision,
  decideVisuals,
  generateHostedVisuals,
  generateLocalVisuals,
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

/**
 * Registers the `visuals` command group for preparing, importing, generating, activating, reviewing, and regenerating scene visual evidence.
 *
 * Hosted generation requires an approved plan, matching manifest and revision digests, and explicit paid-operation confirmation. Mutating commands persist revisions or review decisions, while failures propagate through `wrap` and results are reported as JSON or operator-facing status messages.
 *
 * @param program - The Commander program to which the `visuals` command group is added.
 * @param wrap - The action-handler wrapper used for command execution and failure propagation.
 */
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
    .command("activate-revision")
    .requiredOption("--run <run_id>")
    .requiredOption("--scene <number>")
    .requiredOption("--revision <number>")
    .requiredOption("--expected-manifest-digest <sha256>")
    .requiredOption("--expected-active-revisions-file <path>")
    .option("--json", "Print the updated visual manifest JSON.")
    .description("Activate an existing visual revision and reopen its review decision.")
    .action(
      wrap(async (options: VisualMutationCliOptions & { revision: string; scene: string }) => {
        const manifest = await activateVisualRevision({
          runId: options.run,
          sceneIndex: positiveSceneIndex(options.scene),
          revision: positiveSceneIndex(options.revision),
          ...(await readVisualMutationExpectation(options)),
        });
        console.log(
          options.json
            ? JSON.stringify(manifest, null, 2)
            : `Activated revision ${options.revision} for scene ${options.scene}; review is required again.`,
        );
      }),
    );

  visuals
    .command("generate-local")
    .requiredOption("--run <run_id>")
    .requiredOption("--scenes <list>")
    .requiredOption("--expected-manifest-digest <sha256>")
    .requiredOption("--expected-active-revisions-file <path>")
    .option("--json", "Print the updated visual manifest JSON.")
    .description("Generate selected scene revisions with the installed local MFLUX runtime.")
    .action(
      wrap(async (options: VisualMutationCliOptions & { scenes: string }) => {
        const config = await loadConfigSnapshot();
        const imageGeneration = config.providers.imageGeneration;
        if (!imageGeneration.enabled || imageGeneration.mode !== "mflux-local") {
          throw new SafeExitError(
            "Local visual generation must be enabled and selected in Studio Settings.",
          );
        }
        const expectation = await readVisualMutationExpectation(options);
        const sceneIndexes = parseSceneIndexes(options.scenes, expectation.expectedActiveRevisions);
        const manifest = await generateLocalVisuals(
          { runId: options.run, sceneIndexes, ...expectation },
          createMfluxVisualGenerationBoundary(process.cwd(), imageGeneration.mflux),
        );
        console.log(
          options.json
            ? JSON.stringify(manifest, null, 2)
            : `Generated ${sceneIndexes.length} local visual revision(s) for review.`,
        );
      }),
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
