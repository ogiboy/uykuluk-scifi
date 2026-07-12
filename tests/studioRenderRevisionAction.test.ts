import { describe, expect, it } from "vitest";
import { cliArgsForAction } from "../apps/studio/src/lib/mutations/studioCliMutationArgs";
import { enabledStudioActionRoutes } from "../apps/studio/src/lib/routeSecurity";
import { parseStudioMutationRequest } from "../src/studio/actionServiceContracts";

describe("Studio render revision action", () => {
  it("keeps request, CLI arguments, and route security aligned", async () => {
    const payload = { runId: "run_render_revision" };

    expect(parseStudioMutationRequest("render.revise", payload)).toEqual(payload);
    const prepared = await cliArgsForAction("render.revise", payload);
    expect(prepared.args).toEqual(["revise", "render", "--run", "run_render_revision", "--json"]);
    await prepared.cleanup();
    expect(
      enabledStudioActionRoutes.find((route) => route.serviceContractId === "render.revise"),
    ).toMatchObject({
      enabled: true,
      path: "/actions/revise-render",
      requiredApproval: "render",
      requiresCsrfProtection: true,
      requiresEvidenceWrite: true,
    });
  });
});
