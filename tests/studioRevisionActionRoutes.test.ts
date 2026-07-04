import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST as revisePackageArtifact } from "../apps/studio/src/app/actions/revise-package-artifact/route";
import { POST as reviseScript } from "../apps/studio/src/app/actions/revise-script/route";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";
import {
  studioJsonMutationRequest,
  type StudioMutationRequestOptions,
} from "./studioMutationRouteTestHelpers";

describe("Studio revision action routes", () => {
  useTempProject();

  it("records script revisions through the guarded Studio route without accepting file paths", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await reviewScript(runId);
    const current = await readFile(artifactPath(runId, "script.md"), "utf8");
    const revised = `${current.trim()}\n\nStudio üzerinden eklenen güvenli revizyon.\n`;

    const response = await reviseScript(
      studioJsonRequest("/actions/revise-script", "script.revise", {
        content: revised,
        editor: "operator",
        reason: "Studio web revizyon testi",
        runId,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionId: "script.revise",
      record: {
        artifact: "script.md",
        editor: "operator",
        nextState: "SCRIPT_GENERATED",
        previousState: "SCRIPT_REVIEWED",
        reason: "Studio web revizyon testi",
        runId,
      },
      status: "ok",
    });
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "SCRIPT_GENERATED" });
  });

  it("rejects malformed package artifact revision payloads before core execution", async () => {
    await expectRouteError(
      revisePackageArtifact(
        studioJsonRequest("/actions/revise-package-artifact", "package-artifact.revise", {
          artifactKey: "unsafe",
          content: "1\n00:00:00,000 --> 00:00:02,000\nRevize altyazı.\n",
          editor: "operator",
          reason: "Invalid target",
          runId: "run_revision_route",
        }),
      ),
      400,
    );
    await expectRouteError(
      reviseScript(
        studioJsonRequest("/actions/revise-script", "script.revise", {
          content: "Revize senaryo.",
          editor: "operator",
          file: "../local-script.md",
          reason: "Path input must not be accepted.",
          runId: "run_revision_route",
        }),
      ),
      400,
    );
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
