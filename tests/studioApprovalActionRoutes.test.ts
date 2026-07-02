import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST as approveCost } from "../apps/studio/src/app/actions/approve-cost/route";
import { POST as approveIdea } from "../apps/studio/src/app/actions/approve-idea/route";
import { POST as approveRender } from "../apps/studio/src/app/actions/approve-render/route";
import { POST as approveScript } from "../apps/studio/src/app/actions/approve-script/route";
import { studioActionHeaderName } from "../apps/studio/src/lib/studioMutationSecurity";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";

describe("Studio approval action routes", () => {
  useTempProject();

  it("records explicit idea approval through the guarded Studio route", async () => {
    const run = await createRun();
    await saveRun({ ...run, artifacts: ["ideas.json"], state: "IDEAS_GENERATED" });
    await writeFile(
      artifactPath(run.runId, "ideas.json"),
      JSON.stringify({
        ideas: [
          {
            angle: "Bilimsel dikkatle işlenen uyku teması.",
            hook: "Uykuda sinyal alan bir istasyon.",
            id: "idea_001",
            safetyNotes: ["Kurgu olduğu açıkça belirtilir."],
            title: "UykulukSciFi Test Fikri",
          },
        ],
      }),
      "utf8",
    );

    const response = await approveIdea(
      studioJsonRequest("/actions/approve-idea", "idea.approve", {
        ideaId: "idea_001",
        runId: run.runId,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionId: "idea.approve",
      record: {
        approvedRef: "idea_001",
        nextState: "IDEA_APPROVED",
        target: "idea",
      },
      status: "ok",
    });
    const updated = await loadRun(run.runId);
    expect(updated.state).toBe("IDEA_APPROVED");
    expect(updated.approvedIdeaId).toBe("idea_001");
  });

  it("rejects unsafe or malformed approval requests before core execution", async () => {
    await expectRouteError(approveIdea(studioJsonRequest("/actions/approve-idea", "", {})), 403);
    await expectRouteError(
      approveIdea(
        studioJsonRequest(
          "/actions/approve-idea",
          "idea.approve",
          {},
          { origin: "https://attacker.example" },
        ),
      ),
      403,
    );
    await expectRouteError(
      approveIdea(
        new Request("http://localhost:3000/actions/approve-idea", {
          body: "runId=run_escape",
          headers: {
            [studioActionHeaderName]: "idea.approve",
            "content-type": "application/x-www-form-urlencoded",
            origin: "http://localhost:3000",
          },
          method: "POST",
        }),
      ),
      415,
    );
    await expectRouteError(
      approveIdea(
        studioJsonRequest("/actions/approve-idea", "idea.approve", {
          ideaId: "idea_001",
          runId: "../escape",
        }),
      ),
      400,
    );
    await expectRouteError(
      approveScript(
        studioJsonRequest("/actions/approve-script", "script.approve", {
          extra: true,
          runId: "run_unknown_field",
        }),
      ),
      400,
    );
  });

  it("maps core approval blockers to conflict responses without route-side bypasses", async () => {
    await mkdir("runs", { recursive: true });

    await expectConflict(
      approveScript(
        studioJsonRequest("/actions/approve-script", "script.approve", {
          acknowledgeWarnings: true,
          runId: "run_missing_script",
        }),
      ),
      "Run not found",
    );
    await expectConflict(
      approveCost(
        studioJsonRequest("/actions/approve-cost", "cost.approve", {
          runId: "run_missing_cost",
        }),
      ),
      "Run not found",
    );
    await expectConflict(
      approveRender(
        studioJsonRequest("/actions/approve-render", "render.approve", {
          runId: "run_missing_render",
        }),
      ),
      "Run not found",
    );
  });
});

type StudioRequestOptions = Readonly<{
  origin?: string;
}>;

/**
 * Builds a same-origin JSON request for a Studio approval route.
 *
 * @param routePath - The Studio action route.
 * @param actionHeader - The expected Studio action header.
 * @param body - The JSON request payload.
 * @param options - Header overrides for negative security tests.
 * @returns A Request object suitable for calling the route handler directly.
 */
function studioJsonRequest(
  routePath: string,
  actionHeader: string,
  body: unknown,
  options: StudioRequestOptions = {},
): Request {
  return new Request(`http://localhost:3000${routePath}`, {
    body: JSON.stringify(body),
    headers: {
      [studioActionHeaderName]: actionHeader,
      "content-type": "application/json",
      origin: options.origin ?? "http://localhost:3000",
    },
    method: "POST",
  });
}

async function expectRouteError(responsePromise: Promise<Response>, status: number): Promise<void> {
  const response = await responsePromise;
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toMatchObject({ status: "error" });
}

async function expectConflict(responsePromise: Promise<Response>, message: string): Promise<void> {
  const response = await responsePromise;
  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toMatchObject({
    message: expect.stringContaining(message),
    status: "error",
  });
}
