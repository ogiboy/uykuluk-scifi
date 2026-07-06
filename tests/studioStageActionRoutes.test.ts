import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST as runDoctor } from "../apps/studio/src/app/actions/run-doctor/route";
import { POST as runEvidence } from "../apps/studio/src/app/actions/run-evidence/route";
import { POST as runIdeas } from "../apps/studio/src/app/actions/run-ideas/route";
import { POST as runModelEval } from "../apps/studio/src/app/actions/run-model-eval/route";
import { POST as runReadiness } from "../apps/studio/src/app/actions/run-readiness/route";
import { POST as runRenderPlan } from "../apps/studio/src/app/actions/run-render-plan/route";
import { defaultConfig } from "../src/config/config";
import { createRun } from "../src/core/runStore";
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
      runIdeas(
        studioJsonRequest("/actions/run-ideas", "ideas.run", {
          runId: "run_unexpected",
        }),
      ),
      400,
    );
    await expectRouteError(
      runDoctor(
        studioJsonRequest("/actions/run-doctor", "doctor.run", {
          runId: "run_unexpected",
        }),
      ),
      400,
    );
    await expectRouteError(
      runModelEval(
        studioJsonRequest("/actions/run-model-eval", "model-eval.run", {
          runId: "run_unexpected",
        }),
      ),
      400,
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

    const ideasResponse = await runIdeas(studioJsonRequest("/actions/run-ideas", "ideas.run", {}));
    expect(ideasResponse.status).toBe(200);
    await expect(ideasResponse.json()).resolves.toMatchObject({
      actionId: "ideas.run",
      record: {
        runId: expect.stringMatching(/^run_/),
      },
      status: "ok",
    });
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

  it("preserves JSON diagnostic output when the producer CLI writes evidence then exits blocked", async () => {
    const run = await createRun();

    const response = await runReadiness(
      studioJsonRequest("/actions/run-readiness", "readiness.run", {
        runId: run.runId,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      record: {
        checks: expect.any(Array),
        passed: false,
      },
      status: "error",
    });
  });

  it("preserves doctor diagnostics when local health checks block", async () => {
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          providers: {
            ...defaultConfig.providers,
            youtube: {
              enabled: true,
              allowPrivateUpload: true,
              allowPublicPublish: true,
            },
          },
          safeguards: {
            ...defaultConfig.safeguards,
            neverPublicPublishWithoutExplicitApproval: false,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const response = await runDoctor(studioJsonRequest("/actions/run-doctor", "doctor.run", {}));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      record: {
        checks: expect.any(Array),
        passed: false,
      },
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
