import path from "node:path";
import { describe, expect, it } from "vitest";
import { disabledStudioActionRoutes } from "../apps/studio/src/lib/routeSecurity";
import {
  getStudioMutationServiceContract,
  parseStudioMutationRequest,
  studioMutationServiceContracts,
} from "../src/studio/actionServiceContracts";

describe("Studio mutation service contracts", () => {
  it("covers every disabled Studio action route with a shared core contract", () => {
    const routeContractIds = disabledStudioActionRoutes.map((route) => route.serviceContractId);
    const serviceContractIds = studioMutationServiceContracts.map((contract) => contract.actionId);

    expect(routeContractIds).toEqual(serviceContractIds);
    expect(studioMutationServiceContracts).toEqual(
      expect.arrayContaining([
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
    }
    expect(() =>
      parseStudioMutationRequest("cost.approve", {
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
