import { describe, expect, it } from "vitest";
import { studioActionRoutes } from "../apps/studio/src/lib/routeSecurity";
import {
  getStudioMutationServiceContract,
  studioMutationServiceContracts,
} from "../src/studio/actionServiceContracts";

describe("Studio mutation service contracts", () => {
  it("covers every Studio action route with a shared core contract", () => {
    const routeContractIds = studioActionRoutes
      .map((route) => route.serviceContractId)
      .sort(routeSort);
    const serviceContractIds = studioMutationServiceContracts
      .map((contract) => contract.actionId)
      .sort(routeSort);

    expect(routeContractIds).toEqual(serviceContractIds);
    expect(studioMutationServiceContracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: "channel-handoff.decide",
          availability: "ready-for-cli",
          coreExport: "recordChannelHandoffDecision",
          coreModule: "src/stages/channelHandoffDecision.ts",
        }),
        expect.objectContaining({
          actionId: "doctor.run",
          availability: "ready-for-cli",
          coreExport: "runDoctor",
          coreModule: "src/diagnostics/doctor.ts",
        }),
        expect.objectContaining({
          actionId: "model-eval.run",
          availability: "ready-for-cli",
          coreExport: "runLocalModelEval",
          coreModule: "src/diagnostics/localModelEval.ts",
        }),
        expect.objectContaining({
          actionId: "model-eval-candidates.run",
          availability: "ready-for-cli",
          coreExport: "runLocalModelCandidateEval",
          coreModule: "src/diagnostics/localModelCandidateEval.ts",
        }),
        expect.objectContaining({
          actionId: "idea.approve",
          availability: "ready-for-cli",
          coreExport: "approveIdea",
          coreModule: "src/stages/approveIdea.ts",
        }),
        expect.objectContaining({
          actionId: "publish.schedule",
          availability: "disabled-external",
          coreExport: "runPublishPlaceholder",
          coreModule: "src/youtube/uploadDisabled.ts",
        }),
        expect.objectContaining({
          actionId: "render.decide",
          availability: "ready-for-cli",
          coreExport: "recordRenderDecision",
          coreModule: "src/stages/renderDecision.ts",
        }),
        expect.objectContaining({
          actionId: "render.revise",
          availability: "ready-for-cli",
          coreExport: "reviseRender",
          coreModule: "src/revisions/renderRevision.ts",
        }),
        expect.objectContaining({
          actionId: "render-plan.run",
          availability: "ready-for-cli",
          coreExport: "generateRenderPlan",
          coreModule: "src/stages/renderPlan.ts",
        }),
        expect.objectContaining({
          actionId: "ideas.run",
          availability: "ready-for-cli",
          coreExport: "runIdeas",
          coreModule: "src/stages/ideas.ts",
        }),
        expect.objectContaining({
          actionId: "script.revise",
          availability: "ready-for-cli",
          coreExport: "reviseScript",
          coreModule: "src/revisions/scriptRevision.ts",
        }),
        expect.objectContaining({
          actionId: "package-artifact.revise",
          availability: "ready-for-cli",
          coreExport: "revisePackageArtifact",
          coreModule: "src/revisions/packageArtifactRevision.ts",
        }),
        expect.objectContaining({
          actionId: "voice.candidates",
          availability: "ready-for-cli",
          coreExport: "generateVoiceCandidates",
          coreModule: "src/stages/voiceCandidates.ts",
        }),
        expect.objectContaining({
          actionId: "voice.preview",
          availability: "ready-for-cli",
          coreExport: "generateVoicePreview",
          coreModule: "src/stages/voicePreview.ts",
        }),
        expect.objectContaining({
          actionId: "voice.select",
          availability: "ready-for-cli",
          coreExport: "selectVoice",
          coreModule: "src/stages/voiceSelection.ts",
        }),
        expect.objectContaining({
          actionId: "voice.reselect",
          availability: "ready-for-cli",
          coreExport: "reviseVoiceSelection",
          coreModule: "src/revisions/voiceSelectionRevision.ts",
        }),
        expect.objectContaining({
          actionId: "voice.run",
          availability: "ready-for-cli",
          coreExport: "generateVoiceoverAudio",
          coreModule: "src/stages/voice.ts",
        }),
        expect.objectContaining({
          actionId: "visuals.regenerate",
          availability: "ready-for-cli",
          coreExport: "regenerateRejectedStaticVisuals",
          coreModule: "src/stages/visuals/visualRegeneration.ts",
        }),
      ]),
    );
  });

  it("keeps every contract explicit about CSRF, evidence, and approval gates", () => {
    for (const contract of studioMutationServiceContracts) {
      expect(contract.requiresCsrfProtection).toBe(true);
      expect(contract.requiresDurableEvidence).toBe(true);
      expect(contract.requiresExplicitApproval).toBe(true);
      expect(contract.cliCommand).toMatch(/^pnpm producer /);
    }
  });

  it("documents exact snapshot flags for every visual revision mutation", () => {
    for (const actionId of [
      "visuals.import",
      "visuals.decide",
      "visuals.regenerate",
      "visuals.generate-local",
      "visuals.activate-revision",
    ] as const) {
      const command = getStudioMutationServiceContract(actionId)?.cliCommand;
      expect(command).toContain("--expected-manifest-digest <sha256>");
      expect(command).toContain("--expected-active-revisions-file <temp_json>");
    }
  });

  it("does not expose upload or publish as ready Studio mutations", () => {
    expect(getStudioMutationServiceContract("upload.private")).toMatchObject({
      availability: "disabled-external",
      requiresExplicitApproval: true,
    });
    expect(getStudioMutationServiceContract("publish.schedule")).toMatchObject({
      availability: "disabled-external",
      requiresExplicitApproval: true,
    });
  });
});

function routeSort(left: string | null, right: string | null): number {
  return String(left).localeCompare(String(right));
}
