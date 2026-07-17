import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST as decideVisualsRoute } from "../apps/studio/src/app/actions/visuals-decide/route";
import { POST as regenerateVisualsRoute } from "../apps/studio/src/app/actions/visuals-regenerate/route";
import { cliArgsForAction } from "../apps/studio/src/lib/mutations/studioCliMutationArgs";
import { decideVisuals, prepareStaticVisuals } from "../src/stages/visuals";
import { parseStudioMutationRequest } from "../src/studio/actionServiceContracts";
import { useTempProject } from "./helpers";
import { studioJsonMutationRequest } from "./studioMutationRouteTestHelpers";
import { currentVisualExpectation, preparePackagedVisualRun } from "./visualTestHelpers";

const runId = "run_studio_visuals";
const expectedActiveRevisions = Array.from({ length: 12 }, (_, index) => ({
  activeRevision: 1,
  sceneIndex: index + 1,
}));
const expectation = { expectedActiveRevisions, expectedManifestDigest: "a".repeat(64) };

describe("Studio visual mutation actions", () => {
  useTempProject();

  it("requires the complete manifest snapshot for import, decide, and regenerate payloads", () => {
    const decision = {
      ...expectation,
      notes: "Reviewed against the current contact sheet.",
      reviewedBy: "operator",
      runId,
      sceneIndexes: [1, 2],
      status: "approved" as const,
    };
    const regeneration = { ...expectation, runId, sceneIndexes: [2] };
    const visualImport = {
      ...expectation,
      contentBase64: "aGVsbG8=",
      runId,
      sceneIndex: 1,
      sourceFileName: "replacement.png",
    };

    expect(parseStudioMutationRequest("visuals.decide", decision)).toEqual(decision);
    expect(parseStudioMutationRequest("visuals.regenerate", regeneration)).toEqual(regeneration);
    expect(parseStudioMutationRequest("visuals.import", visualImport)).toEqual(visualImport);
    for (const [actionId, payload] of [
      ["visuals.decide", decision],
      ["visuals.regenerate", regeneration],
      ["visuals.import", visualImport],
    ] as const) {
      const { expectedManifestDigest: _digest, ...withoutDigest } = payload;
      expect(() => parseStudioMutationRequest(actionId, withoutDigest)).toThrow();
      const { expectedActiveRevisions: _revisions, ...withoutRevisions } = payload;
      expect(() => parseStudioMutationRequest(actionId, withoutRevisions)).toThrow();
    }
    expect(() =>
      parseStudioMutationRequest("visuals.regenerate", {
        ...regeneration,
        expectedActiveRevisions: [
          ...expectedActiveRevisions.slice(0, -1),
          { activeRevision: 2, sceneIndex: 1 },
        ],
      }),
    ).toThrow(/unique scene indexes/i);
  });

  it("writes the exact active-revision array to a temporary CLI snapshot for every mutation", async () => {
    await expectVisualCliArgs(
      "visuals.decide",
      {
        ...expectation,
        notes: "Reject weak visual beats.",
        reviewedBy: "operator",
        runId,
        sceneIndexes: [2, 2, 3],
        status: "rejected",
      },
      ["visuals", "decide", "--run", runId, "--scenes", "2,3"],
    );
    await expectVisualCliArgs(
      "visuals.regenerate",
      { ...expectation, runId, sceneIndexes: [2, 3] },
      ["visuals", "regenerate", "--run", runId, "--scenes", "2,3"],
    );
    await expectVisualCliArgs(
      "visuals.import",
      {
        ...expectation,
        contentBase64: "aGVsbG8=",
        runId,
        sceneIndex: 2,
        sourceFileName: "replacement.png",
      },
      ["visuals", "import", "--run", runId, "--scene", "2"],
    );
  });

  it("builds exact hosted plan and paid execution CLI arguments", async () => {
    const planPayload = { purpose: "initial" as const, runId, sceneIndexes: [1, 2, 2] };
    const executionPayload = {
      approvalId: "approval_visual",
      bindingDigest: "b".repeat(64),
      confirmPaidOperation: true as const,
      executionMode: "hosted" as const,
      quoteDigest: "c".repeat(64),
      runId,
    };
    expect(parseStudioMutationRequest("visuals.plan-hosted", planPayload)).toEqual(planPayload);
    expect(parseStudioMutationRequest("visuals.generate-hosted", executionPayload)).toEqual(
      executionPayload,
    );
    const planArgs = await cliArgsForAction("visuals.plan-hosted", planPayload);
    expect(planArgs.args).toEqual([
      "visuals",
      "plan-hosted",
      "--run",
      runId,
      "--scenes",
      "1,2",
      "--purpose",
      "initial",
      "--json",
    ]);
    const regenerationPayload = {
      ...expectation,
      purpose: "regenerate-rejected" as const,
      reason: "Replace the rejected scientific composition.",
      reviewedBy: "visual director",
      runId,
      sceneIndexes: [2],
    };
    expect(parseStudioMutationRequest("visuals.plan-hosted", regenerationPayload)).toEqual(
      regenerationPayload,
    );
    const regenerationArgs = await cliArgsForAction("visuals.plan-hosted", regenerationPayload);
    try {
      expect(regenerationArgs).toMatchObject({
        args: [
          "visuals",
          "plan-hosted",
          "--run",
          runId,
          "--scenes",
          "2",
          "--purpose",
          "regenerate-rejected",
          "--reviewed-by",
          "visual director",
          "--reason",
          "Replace the rejected scientific composition.",
          "--expected-manifest-digest",
          expectation.expectedManifestDigest,
          "--expected-active-revisions-file",
          expect.any(String),
          "--json",
        ],
      });
      const snapshotPath = regenerationArgs.args.at(-2);
      expect(snapshotPath).toBeTruthy();
      await expect(
        readFile(snapshotPath!, "utf8").then((content) => JSON.parse(content) as unknown),
      ).resolves.toEqual(expectedActiveRevisions);
    } finally {
      await regenerationArgs.cleanup();
    }
    expect(() =>
      parseStudioMutationRequest("visuals.plan-hosted", {
        purpose: "regenerate-rejected",
        runId,
        sceneIndexes: [2],
      }),
    ).toThrow(/reviewer|reason/i);
    const executionArgs = await cliArgsForAction("visuals.generate-hosted", executionPayload);
    expect(executionArgs.args).toEqual([
      "visuals",
      "generate-hosted",
      "--run",
      runId,
      "--binding-digest",
      executionPayload.bindingDigest,
      "--quote-digest",
      executionPayload.quoteDigest,
      "--approval-id",
      executionPayload.approvalId,
      "--confirm-paid-operation",
      "--json",
    ]);
    expect(() =>
      parseStudioMutationRequest("visuals.generate-hosted", {
        ...executionPayload,
        confirmPaidOperation: false,
      }),
    ).toThrow();
  });

  it("rejects stale snapshots and wrong action headers at the guarded route", async () => {
    const packagedRunId = await preparePackagedVisualRun();
    await prepareStaticVisuals(packagedRunId);
    const stale = await currentVisualExpectation(packagedRunId);
    await decideVisuals({
      ...stale,
      notes: "Change the manifest after the browser snapshot.",
      reviewedBy: "operator",
      runId: packagedRunId,
      sceneIndexes: [1],
      status: "rejected",
    });

    const staleResponse = await decideVisualsRoute(
      studioJsonMutationRequest("/actions/visuals-decide", "visuals.decide", {
        ...stale,
        notes: "This browser request is stale.",
        reviewedBy: "operator",
        runId: packagedRunId,
        sceneIndexes: [2],
        status: "approved",
      }),
    );
    expect(staleResponse.status).toBe(409);
    await expect(staleResponse.json()).resolves.toMatchObject({
      message: expect.stringMatching(/manifest changed/i),
      status: "error",
    });

    const wrongAction = await regenerateVisualsRoute(
      studioJsonMutationRequest(
        "/actions/visuals-regenerate",
        "visuals.regenerate",
        {
          ...(await currentVisualExpectation(packagedRunId)),
          runId: packagedRunId,
          sceneIndexes: [1],
        },
        { actionHeader: "visuals.decide" },
      ),
    );
    expect(wrongAction.status).toBe(403);
  });
});

async function expectVisualCliArgs(
  actionId: Parameters<typeof cliArgsForAction>[0],
  payload: unknown,
  expectedPrefix: readonly string[],
): Promise<void> {
  const prepared = await cliArgsForAction(actionId, payload);
  try {
    expect(prepared.args.slice(0, expectedPrefix.length)).toEqual(expectedPrefix);
    expect(prepared.args).toContain("--expected-manifest-digest");
    expect(prepared.args).toContain(expectation.expectedManifestDigest);
    const snapshotFlag = prepared.args.indexOf("--expected-active-revisions-file");
    expect(snapshotFlag).toBeGreaterThan(0);
    const snapshotPath = prepared.args[snapshotFlag + 1];
    expect(snapshotPath).toBeTruthy();
    await expect(
      readFile(snapshotPath!, "utf8").then((content) => JSON.parse(content) as unknown),
    ).resolves.toEqual(expectedActiveRevisions);
  } finally {
    await prepared.cleanup();
  }
}
