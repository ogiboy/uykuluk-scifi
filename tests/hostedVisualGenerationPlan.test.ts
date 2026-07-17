import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig, loadConfig } from "../src/config/config";
import { producerConfigSchema } from "../src/config/schema";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import { quoteCostStages } from "../src/costs/costQuoteStages";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { estimateCost } from "../src/stages/estimate";
import { prepareStaticVisuals } from "../src/stages/visuals";
import { buildHostedVisualGenerationPlan } from "../src/stages/visuals/visualGenerationPlan";
import { hostedVisualGenerationPlanPath } from "../src/stages/visuals/visualGenerationPlanContracts";
import {
  loadHostedVisualGenerationPlan,
  prepareHostedVisualGenerationPlan,
} from "../src/stages/visuals/visualGenerationPlanStore";
import { loadVisualManifest } from "../src/stages/visuals/visualManifest";
import { useTempProject } from "./helpers";
import { currentVisualExpectation, preparePackagedVisualRun } from "./visualTestHelpers";

describe("hosted visual generation plan", () => {
  useTempProject();

  it("builds a deterministic exact binding and quotes the persisted scene cap", async () => {
    await configureHostedVisuals({ requireApprovalAboveUsd: 1 });
    const runId = await prepareHostedPlanRun();
    const run = await loadRun(runId);
    const manifest = await loadVisualManifest(run);
    const config = await loadConfig();
    const first = buildHostedVisualGenerationPlan({
      runId,
      createdAt: "2026-07-15T10:00:00.000Z",
      visualManifest: manifest.manifest,
      visualManifestDigest: manifest.digest,
      purpose: "initial",
      sceneIndexes: [3, 1],
      config: config.providers.imageGeneration,
    });
    const second = buildHostedVisualGenerationPlan({
      runId,
      createdAt: "2026-07-15T11:00:00.000Z",
      visualManifest: manifest.manifest,
      visualManifestDigest: manifest.digest,
      purpose: "initial",
      sceneIndexes: [1, 3],
      config: config.providers.imageGeneration,
    });

    expect(second.bindingDigest).toBe(first.bindingDigest);
    expect(second.scenes.map((scene) => scene.seed)).toEqual(
      first.scenes.map((scene) => scene.seed),
    );
    expect(first).toMatchObject({
      purpose: "initial",
      targetedSceneIndexes: [1, 3],
      provider: "black-forest-labs",
      model: "flux-2-pro",
      pricing: { estimatedUsdPerImage: 0.09, maximumUsdPerImage: 0.09 },
      totalMaximumUsd: 0.18,
    });

    const persisted = await prepareHostedVisualGenerationPlan({
      runId,
      purpose: "initial",
      sceneIndexes: [1, 3],
    });
    expect((await loadRun(runId)).artifacts).toContain(hostedVisualGenerationPlanPath);
    const loaded = await loadHostedVisualGenerationPlan(await loadRun(runId), config);
    await estimateCost(runId);
    const imageQuote = (await readCostEstimate(runId)).estimate.stages.find(
      (stage) => stage.stage === "imageGeneration",
    );
    expect(imageQuote).toMatchObject({
      provider: "black-forest-labs",
      model: "flux-2-pro",
      bindingDigest: loaded.digest,
      bindingSummary: {
        kind: "hosted-visual-generation",
        planDigest: loaded.digest,
        targetedSceneIndexes: [1, 3],
        maximumUsdPerImage: 0.09,
        totalMaximumUsd: 0.18,
      },
      enabled: true,
      estimatedUsd: 0.18,
    });
    expect(loaded.digest).not.toBe(persisted.bindingDigest);
    expect((await readCostEstimate(runId)).estimate.approvalRequired).toBe(true);
  });

  it("fails closed when hosted mode has no active plan", async () => {
    await configureHostedVisuals();
    const runId = await prepareHostedPlanRun();

    await expect(estimateCost(runId)).rejects.toThrow(/hosted visual generation plan is missing/i);
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "PRODUCTION_PACKAGE_GENERATED" });
  });

  it("reports malformed or schema-invalid persisted plans as safe operator errors", async () => {
    await configureHostedVisuals();
    const runId = await prepareHostedPlanRun();
    await prepareHostedVisualGenerationPlan({ runId, purpose: "initial", sceneIndexes: [1] });
    const target = artifactPath(runId, hostedVisualGenerationPlanPath);
    for (const invalidPlan of ["{malformed", "{}\n"]) {
      await writeFile(target, invalidPlan, "utf8");
      await expect(
        loadHostedVisualGenerationPlan(await loadRun(runId), await loadConfig()),
      ).rejects.toMatchObject({
        name: "SafeExitError",
        message: "Hosted visual generation plan is malformed or invalid.",
      });
    }
  });

  it("rejects plan tampering and active-manifest drift", async () => {
    await configureHostedVisuals();
    const runId = await prepareHostedPlanRun();
    await prepareHostedVisualGenerationPlan({ runId, purpose: "initial", sceneIndexes: [1, 2] });
    const planPath = artifactPath(runId, hostedVisualGenerationPlanPath);
    const plan = JSON.parse(await readFile(planPath, "utf8")) as {
      scenes: Array<{ prompt: string }>;
    };
    plan.scenes[0].prompt = "tampered prompt";
    await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

    await expect(estimateCost(runId)).rejects.toThrow(/binding digest is invalid/i);

    await prepareHostedVisualGenerationPlan({ runId, purpose: "initial", sceneIndexes: [1, 2] });
    const manifestPath = artifactPath(runId, "production/visuals/manifest.json");
    const activeManifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      scenes: Array<{ visualPrompt: string }>;
    };
    activeManifest.scenes[0].visualPrompt = "prompt text changed without provenance update";
    await writeFile(manifestPath, `${JSON.stringify(activeManifest, null, 2)}\n`, "utf8");

    await expect(estimateCost(runId)).rejects.toThrow(/stale prompt evidence/i);
  });

  it("requires rejected active revisions for regeneration plans", async () => {
    await configureHostedVisuals();
    const runId = await prepareHostedPlanRun();

    await expect(
      prepareHostedVisualGenerationPlan({
        ...(await currentVisualExpectation(runId)),
        runId,
        purpose: "regenerate-rejected",
        sceneIndexes: [1],
        reviewedBy: "visual director",
        reason: "Verify that pending scenes cannot enter rejected regeneration.",
      }),
    ).rejects.toThrow(/reject its active revision before regeneration/i);
  });

  it("rejects approval when the exact persisted plan changed after quoting", async () => {
    await configureHostedVisuals();
    const runId = await prepareHostedPlanRun();
    await prepareHostedVisualGenerationPlan({ runId, purpose: "initial", sceneIndexes: [1, 2] });
    await estimateCost(runId);
    const target = artifactPath(runId, hostedVisualGenerationPlanPath);
    const plan = JSON.parse(await readFile(target, "utf8")) as { createdAt: string };
    plan.createdAt = new Date(Date.parse(plan.createdAt) + 1_000).toISOString();
    await writeFile(target, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

    await expect(approvePaidGenerationCost(runId)).rejects.toThrow(
      /stale|stage pricing|quoted stages/i,
    );
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "COST_ESTIMATED" });
  });

  it("keeps legacy static/manual image stages disabled and zero-cost", async () => {
    const config = producerConfigSchema.parse({
      ...defaultConfig,
      providers: {
        ...defaultConfig.providers,
        imageGeneration: { enabled: true, requiresApproval: true },
      },
    });
    const stages = await quoteCostStages(
      {
        runId: "run_static",
        state: "PRODUCTION_PACKAGE_GENERATED",
        createdAt: "2026-07-15T10:00:00.000Z",
        updatedAt: "2026-07-15T10:00:00.000Z",
        approvals: [],
        artifacts: [],
        warnings: [],
      },
      config,
    );

    expect(stages.find((stage) => stage.stage === "imageGeneration")).toMatchObject({
      provider: "disabled",
      enabled: false,
      estimatedUsd: 0,
    });
    expect(stages.find((stage) => stage.stage === "videoGeneration")).toMatchObject({
      provider: "disabled",
      enabled: false,
      estimatedUsd: 0,
    });
  });
});

async function configureHostedVisuals(
  budgets: Partial<typeof defaultConfig.budgets> = {},
): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          imageGeneration: {
            ...defaultConfig.providers.imageGeneration,
            enabled: true,
            mode: "black-forest-labs",
          },
        },
        budgets: { ...defaultConfig.budgets, ...budgets },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function prepareHostedPlanRun(): Promise<string> {
  const runId = await preparePackagedVisualRun();
  await prepareStaticVisuals(runId);
  return runId;
}
