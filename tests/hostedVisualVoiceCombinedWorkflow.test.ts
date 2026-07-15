import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ convertWithTimestamps: vi.fn() }));

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    readonly textToSpeech = { convertWithTimestamps: sdk.convertWithTimestamps };
  },
}));

import { loadConfig } from "../src/config/config";
import type { ProducerConfig } from "../src/config/schema";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate, readCostEstimateByDigestAtProjectRoot } from "../src/costs/costEstimate";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runReadiness } from "../src/stages/readiness";
import { generateRenderPlan } from "../src/stages/renderPlan";
import {
  decideVisuals,
  generateHostedVisuals,
  prepareHostedVisualGenerationPlan,
} from "../src/stages/visuals";
import type { HostedVisualGenerationPlan } from "../src/stages/visuals/visualGenerationPlanContracts";
import { loadHostedVisualGenerationPlan } from "../src/stages/visuals/visualGenerationPlanStore";
import { readHostedVisualGenerationRevision } from "../src/stages/visuals/visualGenerationRevision";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { selectVoice } from "../src/stages/voiceSelection";
import { sha256 } from "../src/utils/hash";
import {
  approvedHostedVoiceConfirmation,
  configureWorkflowElevenLabs,
  paidVoiceSubscription,
  preparePackagedWorkflowRun,
  workflowConvertWithTimestamps,
} from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import { currentVisualExpectation, prepareApprovedStaticVisuals } from "./visualTestHelpers";
import {
  successfulCatalogProvider,
  successfulExecutionMetadataProvider,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

describe("combined hosted voice and visual workflow", () => {
  useTempProject();

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "combined-workflow-elevenlabs-key";
    sdk.convertWithTimestamps.mockReset();
    sdk.convertWithTimestamps.mockImplementation(workflowConvertWithTimestamps);
  });

  it("re-quotes only rejected visuals and recovers the settled voice spool", async () => {
    await configureCombinedProviders();
    const runId = await preparePackagedWorkflowRun();
    const catalog = await generateVoiceCandidates(runId, {
      provider: successfulCatalogProvider({ subscription: paidVoiceSubscription }),
    });
    const voiceId = catalog.candidates[0]!.voiceId;
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    await selectVoice(runId, {
      voiceId,
      reviewedBy: "combined workflow operator",
      notes: "Selected the production voice before the combined quote.",
      confirmProductionRights: true,
    });
    await prepareApprovedStaticVisuals(runId);
    await generateRenderPlan(runId);
    await prepareHostedVisualGenerationPlan({ runId, purpose: "initial", sceneIndexes: [1, 2] });

    await estimateCost(runId);
    const firstQuote = await readCostEstimate(runId);
    expect(firstQuote.estimate.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "tts", enabled: true, provider: "elevenlabs" }),
        expect.objectContaining({ stage: "imageGeneration", enabled: true, estimatedUsd: 0.18 }),
      ]),
    );
    const firstApproval = await approvePaidGenerationCost(runId);
    await generateEvidenceBundle(runId);
    expect((await runReadiness(runId)).passed).toBe(true);

    await generateVoiceoverAudio(runId, {
      confirmation: await approvedHostedVoiceConfirmation(runId),
      metadataProvider: successfulExecutionMetadataProvider({
        subscription: paidVoiceSubscription,
      }),
    });
    const voiceProviderCalls = sdk.convertWithTimestamps.mock.calls.length;
    expect(voiceProviderCalls).toBeGreaterThan(0);

    const firstPlan = await currentPlan(runId);
    await generateHostedVisuals({
      runId,
      confirmation: {
        approvalId: firstApproval.approvalId,
        bindingDigest: firstPlan.digest,
        quoteDigest: firstQuote.digest,
        confirmPaidOperation: true,
      },
      dependencies: {
        readApiKey: () => "combined-workflow-bfl-key",
        executeScene: hostedSceneExecutor("initial") as never,
      },
    });
    await decideVisuals({
      runId,
      sceneIndexes: [1],
      status: "rejected",
      reviewedBy: "combined workflow operator",
      notes: "Scene one needs regeneration.",
      ...(await currentVisualExpectation(runId)),
    });
    await decideVisuals({
      runId,
      sceneIndexes: [2],
      status: "approved",
      reviewedBy: "combined workflow operator",
      notes: "Scene two is accepted.",
      ...(await currentVisualExpectation(runId)),
    });

    await prepareHostedVisualGenerationPlan({
      ...(await currentVisualExpectation(runId)),
      runId,
      purpose: "regenerate-rejected",
      sceneIndexes: [1],
      reviewedBy: "combined workflow operator",
      reason: "Regenerate only the rejected scene.",
    });
    const reopened = await loadRun(runId);
    expect(reopened.state).toBe("PRODUCTION_PACKAGE_GENERATED");
    const revisionPath = reopened.artifacts.find((item) =>
      /^revisions\/hosted-visual\/[^/]+\/revision\.json$/.test(item),
    );
    if (!revisionPath) throw new Error("Expected hosted visual revision evidence.");
    const revision = await readHostedVisualGenerationRevision(runId, revisionPath.split("/")[2]!);
    expect(revision).toMatchObject({
      previousPlan: { digest: firstPlan.digest },
      previousQuote: { digest: firstQuote.digest, approvalId: firstApproval.approvalId },
      rejectedSceneIndexes: [1],
    });
    await expect(
      readCostEstimateByDigestAtProjectRoot(process.cwd(), reopened, firstQuote.digest),
    ).resolves.toMatchObject({ digest: firstQuote.digest });

    await estimateCost(runId);
    const secondQuote = await readCostEstimate(runId);
    expect(secondQuote.estimate.stages.find((stage) => stage.stage === "tts")).toMatchObject({
      bindingSummary: { kind: "settled-paid-stage", originalQuoteDigest: firstQuote.digest },
      enabled: false,
      estimatedUsd: 0,
    });
    expect(
      secondQuote.estimate.stages.find((stage) => stage.stage === "imageGeneration"),
    ).toMatchObject({
      bindingSummary: { kind: "hosted-visual-generation", targetedSceneIndexes: [1] },
      enabled: true,
      estimatedUsd: 0.09,
    });
    const secondApproval = await approvePaidGenerationCost(runId);
    expect((await loadRun(runId)).state).toBe("PAID_GENERATION_COST_APPROVED");

    const secondPlan = await currentPlan(runId);
    await generateHostedVisuals({
      runId,
      confirmation: {
        approvalId: secondApproval.approvalId,
        bindingDigest: secondPlan.digest,
        quoteDigest: secondQuote.digest,
        confirmPaidOperation: true,
      },
      dependencies: {
        readApiKey: () => "combined-workflow-bfl-key",
        executeScene: hostedSceneExecutor("regenerated", 8) as never,
      },
    });
    expect((await loadRun(runId)).state).toBe("PAID_GENERATION_COST_APPROVED");
    await decideVisuals({
      runId,
      sceneIndexes: [1],
      status: "approved",
      reviewedBy: "combined workflow operator",
      notes: "Regenerated scene one is accepted.",
      ...(await currentVisualExpectation(runId)),
    });
    await generateRenderPlan(runId);

    await generateVoiceoverAudio(runId);
    expect(sdk.convertWithTimestamps).toHaveBeenCalledTimes(voiceProviderCalls);
    await generateEvidenceBundle(runId);
    const finalReadiness = await runReadiness(runId);
    if (!finalReadiness.passed) {
      throw new Error(
        finalReadiness.checks
          .filter((check) => check.status === "block")
          .map((check) => `${check.name}: ${check.message}`)
          .join("\n"),
      );
    }
    expect((await loadRun(runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
  });
});

async function configureCombinedProviders(): Promise<void> {
  await configureWorkflowElevenLabs();
  const config = JSON.parse(await readFile("producer.config.json", "utf8")) as ProducerConfig;
  config.providers.imageGeneration.enabled = true;
  config.providers.imageGeneration.mode = "black-forest-labs";
  config.budgets = { ...config.budgets, perVideoUsd: 5, dailyUsd: 10, weeklyUsd: 20 };
  await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function currentPlan(runId: string) {
  return loadHostedVisualGenerationPlan(await loadRun(runId), await loadConfig());
}

function hostedSceneExecutor(batch: string, billableCredits = 9) {
  return vi.fn(
    async ({ plan, sceneIndex }: { plan: HostedVisualGenerationPlan; sceneIndex: number }) => {
      const prompt = plan.scenes.find((scene) => scene.sceneIndex === sceneIndex)?.prompt;
      if (!prompt) throw new Error(`Missing planned prompt for scene ${sceneIndex}.`);
      const buffer = Buffer.from(`${batch}-hosted-image-${sceneIndex}`);
      const requestId = `${batch}-bfl-request-${sceneIndex}`;
      return {
        kind: "success" as const,
        value: {
          buffer,
          digest: createHash("sha256").update(buffer).digest("hex"),
          extension: "jpg" as const,
          media: { bytes: buffer.byteLength, format: "jpeg" as const, width: 1920, height: 1080 },
          provider: {
            service: "black-forest-labs" as const,
            modelId: "flux-2-pro" as const,
            outputFormat: "jpeg" as const,
          },
          providerBilling: {
            source: "provider-reported-credits-approved-tariff-derived-usd" as const,
            billableCredits,
            usdPerCredit: 0.01 as const,
            derivedUsdMicros: billableCredits * 10_000,
          },
          providerRequest: { inputDigest: sha256(prompt), requestIdHash: sha256(requestId) },
        },
        actualUsdMicros: billableCredits * 10_000,
        providerRequestId: requestId,
      };
    },
  );
}
