import { mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST as runEvidence } from "../apps/studio/src/app/actions/run-evidence/route";
import { POST as runRenderPlan } from "../apps/studio/src/app/actions/run-render-plan/route";
import { useTempProject } from "./helpers";
import {
  studioJsonMutationRequest,
  type StudioMutationRequestOptions,
} from "./studioMutationRouteTestHelpers";

describe("Studio workflow stage action routes", () => {
  useTempProject();

  it("rejects unsafe or malformed workflow-stage requests before core execution", async () => {
    await expectRouteError(runEvidence(studioJsonRequest("/actions/run-evidence", "", {})), 403);
    await expectRouteError(
      runEvidence(
        studioJsonRequest(
          "/actions/run-evidence",
          "evidence.run",
          {},
          { origin: "https://attacker.example" },
        ),
      ),
      403,
    );
    await expectRouteError(
      runEvidence(
        studioJsonRequest("/actions/run-evidence", "evidence.run", {
          runId: "../escape",
        }),
      ),
      400,
    );
    await expectRouteError(
      runRenderPlan(
        studioJsonRequest("/actions/run-render-plan", "render-plan.run", {
          extra: true,
          runId: "run_stage_route",
        }),
      ),
      400,
    );
  });

  it("maps core workflow blockers to conflict responses without route-side bypasses", async () => {
    await mkdir("runs", { recursive: true });

    const response = await runEvidence(
      studioJsonRequest("/actions/run-evidence", "evidence.run", {
        runId: "run_missing_stage",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("Run not found"),
      status: "error",
    });
  });
});

function studioJsonRequest(
  routePath: string,
  actionHeader: string,
  body: unknown,
  options: StudioMutationRequestOptions = {},
): Request {
  return studioJsonMutationRequest(routePath, actionHeader, body, options);
}

async function expectRouteError(responsePromise: Promise<Response>, status: number): Promise<void> {
  const response = await responsePromise;
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toMatchObject({ status: "error" });
}
