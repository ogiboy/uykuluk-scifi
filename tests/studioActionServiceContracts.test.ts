import path from "node:path";
import { describe, expect, it } from "vitest";
import { studioActionRoutes } from "../apps/studio/src/lib/routeSecurity";
import {
  getStudioMutationServiceContract,
  parseStudioMutationRequest,
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
          actionId: "voice.run",
          availability: "ready-for-cli",
          coreExport: "generateVoiceoverAudio",
          coreModule: "src/stages/voice.ts",
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

  it("parses action payloads without allowing path-shaped run ids or unknown fields", () => {
    expect(
      parseStudioMutationRequest("idea.approve", {
        ideaId: "idea_001",
        runId: "run_operator_review",
      }),
    ).toEqual({ ideaId: "idea_001", runId: "run_operator_review" });
    expect(
      parseStudioMutationRequest("script.approve", {
        acknowledgeWarnings: true,
        runId: "run_operator_review",
      }),
    ).toEqual({ acknowledgeWarnings: true, runId: "run_operator_review" });
    expect(
      parseStudioMutationRequest("script.approve", {
        runId: "run_operator_review",
      }),
    ).toEqual({ acknowledgeWarnings: false, runId: "run_operator_review" });
    expect(
      parseStudioMutationRequest("channel-handoff.decide", {
        decision: "accepted-for-manual-channel-prep",
        notes: "Manual channel handoff is ready for operator-managed upload prep.",
        reviewedBy: "operator",
        runId: "run_operator_review",
        thumbnailCandidateId: "thumbnail-01-left",
      }),
    ).toEqual({
      decision: "accepted-for-manual-channel-prep",
      notes: "Manual channel handoff is ready for operator-managed upload prep.",
      reviewedBy: "operator",
      runId: "run_operator_review",
      thumbnailCandidateId: "thumbnail-01-left",
    });
    expect(
      parseStudioMutationRequest("channel-handoff.decide", {
        decision: "needs-revision",
        notes: "Revise thumbnail copy before upload prep.",
        reviewedBy: "operator",
        runId: "run_operator_review",
      }),
    ).toEqual({
      decision: "needs-revision",
      notes: "Revise thumbnail copy before upload prep.",
      reviewedBy: "operator",
      runId: "run_operator_review",
    });
    expect(() =>
      parseStudioMutationRequest("channel-handoff.decide", {
        decision: "accepted-for-manual-channel-prep",
        notes: "Accepted decisions need a selected thumbnail.",
        reviewedBy: "operator",
        runId: "run_operator_review",
      }),
    ).toThrow(/thumbnail candidate/);

    expect(
      parseStudioMutationRequest("render.decide", {
        decision: "needs-revision",
        notes: "Subtitle timing needs another pass.",
        reviewedBy: "operator",
        runId: "run_operator_review",
      }),
    ).toEqual({
      decision: "needs-revision",
      notes: "Subtitle timing needs another pass.",
      reviewedBy: "operator",
      runId: "run_operator_review",
    });
    expect(() =>
      parseStudioMutationRequest("render.decide", {
        decision: "accepted-for-local-review",
        notes: "",
        reviewedBy: "operator",
        runId: "run_operator_review",
      }),
    ).toThrow();

    expect(() => parseStudioMutationRequest("render.approve", { runId: "../run_escape" })).toThrow(
      /Invalid run id/,
    );
    for (const runId of [
      path.join(path.sep, "tmp", "run_escape"),
      "run_escape/child",
      "run_escape child",
      "bad_operator_review",
      `run_${"a".repeat(125)}`,
    ]) {
      expect(() => parseStudioMutationRequest("cost.approve", { runId })).toThrow(/Invalid run id/);
      expect(() =>
        parseStudioMutationRequest("channel-handoff.decide", {
          decision: "needs-revision",
          notes: "Malformed run id should fail.",
          reviewedBy: "operator",
          runId,
        }),
      ).toThrow(/Invalid run id/);
    }
    expect(() =>
      parseStudioMutationRequest("cost.approve", {
        extra: true,
        runId: "run_operator_review",
      }),
    ).toThrow(/Unrecognized key/);
    expect(parseStudioMutationRequest("render-plan.run", { runId: "run_operator_review" })).toEqual(
      { runId: "run_operator_review" },
    );
    expect(parseStudioMutationRequest("ideas.run", {})).toEqual({});
    expect(() => parseStudioMutationRequest("ideas.run", { runId: "run_operator_review" })).toThrow(
      /Unrecognized key/,
    );
    expect(() =>
      parseStudioMutationRequest("voice.run", {
        extra: true,
        runId: "run_operator_review",
      }),
    ).toThrow(/Unrecognized key/);
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
