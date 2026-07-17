import type { ProducerConfig } from "../../config/schema.js";
import { SafeExitError } from "../../core/errors.js";
import { microsToUsd, usdToMicros, usdToMicrosCeil } from "../../costs/money.js";
import type { VisualManifest } from "./visualContracts.js";
import { canonicalVisualGenerationDigest } from "./visualGenerationDigest.js";
import {
  hostedVisualGenerationPlanSchema,
  type HostedVisualGenerationPlan,
} from "./visualGenerationPlanContracts.js";

type ImageGenerationConfig = ProducerConfig["providers"]["imageGeneration"];

/** Builds one exact, deterministic FLUX.2 Pro plan from the active visual manifest. */
export function buildHostedVisualGenerationPlan(
  input: Readonly<{
    runId: string;
    createdAt: string;
    visualManifest: VisualManifest;
    visualManifestDigest: string;
    purpose: "initial" | "regenerate-rejected";
    sceneIndexes: readonly number[];
    config: ImageGenerationConfig;
  }>,
): HostedVisualGenerationPlan {
  assertHostedMode(input.config);
  if (input.visualManifest.runId !== input.runId) {
    throw new SafeExitError("Hosted visual plan manifest belongs to a different run.");
  }
  const targetedSceneIndexes = [...input.sceneIndexes].sort((left, right) => left - right);
  if (
    targetedSceneIndexes.length === 0 ||
    new Set(targetedSceneIndexes).size !== targetedSceneIndexes.length
  ) {
    throw new SafeExitError("Hosted visual plan requires unique targeted scene indexes.");
  }
  const selectedScenes = targetedSceneIndexes.map((sceneIndex) => {
    const scene = input.visualManifest.scenes.find((item) => item.sceneIndex === sceneIndex);
    if (!scene) throw new SafeExitError(`Hosted visual scene ${sceneIndex} does not exist.`);
    const activeRevision = scene.revisions.find(
      (revision) => revision.revision === scene.activeRevision,
    );
    if (!activeRevision) {
      throw new SafeExitError(`Hosted visual scene ${sceneIndex} has no active revision.`);
    }
    if (
      input.purpose === "regenerate-rejected" &&
      (scene.decision?.status !== "rejected" || scene.decision.revision !== scene.activeRevision)
    ) {
      throw new SafeExitError(
        `Hosted visual scene ${sceneIndex} must reject its active revision before regeneration.`,
      );
    }
    const activeRevisionDigest = canonicalVisualGenerationDigest(activeRevision);
    return {
      sceneIndex,
      prompt: scene.visualPrompt,
      promptDigest: scene.promptDigest,
      activeRevision: scene.activeRevision,
      activeRevisionDigest,
      seed: deterministicSceneSeed({
        runId: input.runId,
        sceneIndex,
        promptDigest: scene.promptDigest,
        activeRevisionDigest,
      }),
      maximumUsd: normalizedMaximumUsd(input.config),
    };
  });
  const hosted = input.config.flux2Pro;
  const settings = {
    endpoint: hosted.endpoint,
    width: hosted.width,
    height: hosted.height,
    outputFormat: hosted.outputFormat,
    safetyTolerance: hosted.safetyTolerance,
    timeoutMs: hosted.timeoutMs,
    pollIntervalMs: hosted.pollIntervalMs,
    maxPollAttempts: hosted.maxPollAttempts,
  };
  const pricingInput = {
    source: "configured-snapshot" as const,
    snapshotId: hosted.pricing.snapshotId,
    usdPerMegapixel: hosted.pricing.usdPerMegapixel,
    usdPerCredit: hosted.pricing.usdPerCredit,
    estimatedUsdPerImage: microsToUsd(
      usdToMicrosCeil(
        Math.ceil((hosted.width * hosted.height) / 1_000_000) * hosted.pricing.usdPerMegapixel,
      ),
    ),
    maximumUsdPerImage: normalizedMaximumUsd(input.config),
  };
  const pricing = { ...pricingInput, digest: canonicalVisualGenerationDigest(pricingInput) };
  const bindingInput = {
    schemaVersion: 1 as const,
    runId: input.runId,
    productionPackage: input.visualManifest.productionPackage,
    visualManifest: {
      path: "production/visuals/manifest.json" as const,
      digest: input.visualManifestDigest,
    },
    purpose: input.purpose,
    targetedSceneIndexes,
    provider: "black-forest-labs" as const,
    model: hosted.model,
    settings,
    pricing,
    scenes: selectedScenes,
    totalMaximumUsd: microsToUsd(
      selectedScenes.reduce((total, scene) => total + usdToMicros(scene.maximumUsd), 0),
    ),
  };
  return requireHostedVisualGenerationPlan({
    ...bindingInput,
    createdAt: input.createdAt,
    bindingDigest: canonicalVisualGenerationDigest(bindingInput),
  });
}

/** Parses a hosted plan and verifies every internal cost and binding digest. */
export function requireHostedVisualGenerationPlan(value: unknown): HostedVisualGenerationPlan {
  const plan = hostedVisualGenerationPlanSchema.parse(value);
  const expectedIndexes = plan.scenes.map((scene) => scene.sceneIndex);
  if (JSON.stringify(plan.targetedSceneIndexes) !== JSON.stringify(expectedIndexes)) {
    throw new SafeExitError("Hosted visual targeted scene indexes do not match the scene plan.");
  }
  if (
    new Set(expectedIndexes).size !== expectedIndexes.length ||
    expectedIndexes.some(
      (sceneIndex, index) => index > 0 && sceneIndex <= expectedIndexes[index - 1],
    )
  ) {
    throw new SafeExitError("Hosted visual scene plan must be unique and sorted.");
  }
  const { digest: pricingDigest, ...pricingInput } = plan.pricing;
  if (canonicalVisualGenerationDigest(pricingInput) !== pricingDigest) {
    throw new SafeExitError("Hosted visual pricing snapshot digest is invalid.");
  }
  if (
    plan.scenes.some(
      (scene) => usdToMicros(scene.maximumUsd) !== usdToMicros(plan.pricing.maximumUsdPerImage),
    )
  ) {
    throw new SafeExitError("Hosted visual scene cost cap does not match the pricing snapshot.");
  }
  const expectedTotalMicros = plan.scenes.reduce(
    (total, scene) => total + usdToMicros(scene.maximumUsd),
    0,
  );
  if (usdToMicros(plan.totalMaximumUsd) !== expectedTotalMicros) {
    throw new SafeExitError("Hosted visual total cost cap does not match the scene plan.");
  }
  const { bindingDigest, createdAt: _createdAt, ...bindingInput } = plan;
  if (canonicalVisualGenerationDigest(bindingInput) !== bindingDigest) {
    throw new SafeExitError("Hosted visual generation binding digest is invalid.");
  }
  return plan;
}

function assertHostedMode(config: ImageGenerationConfig): void {
  if (!config.enabled || config.mode !== "black-forest-labs") {
    throw new SafeExitError("Hosted visual plan requires enabled Black Forest Labs mode.");
  }
}

function normalizedMaximumUsd(config: ImageGenerationConfig): number {
  return microsToUsd(usdToMicrosCeil(config.flux2Pro.pricing.maximumUsdPerImage));
}

function deterministicSceneSeed(input: {
  runId: string;
  sceneIndex: number;
  promptDigest: string;
  activeRevisionDigest: string;
}): number {
  return Number.parseInt(canonicalVisualGenerationDigest(input).slice(0, 8), 16);
}
