import { describe, expect, it } from "vitest";

import { readLedger } from "../src/core/ledger";
import { prepareHostedVisualGenerationPlan } from "../src/stages/visuals";
import { useTempProject } from "./helpers";
import { prepareApprovedHostedVisualRun } from "./hostedVisualWorkflowTestHelpers";
import { currentVisualExpectation } from "./visualTestHelpers";

describe("hosted visual regeneration preflight evidence", () => {
  useTempProject();

  it("records missing reviewer attribution as a blocked guard", async () => {
    const runId = await prepareApprovedHostedVisualRun();

    await expect(
      prepareHostedVisualGenerationPlan({
        ...(await currentVisualExpectation(runId)),
        runId,
        purpose: "regenerate-rejected",
        sceneIndexes: [1],
        reason: "Missing reviewer must be blocked.",
      }),
    ).rejects.toThrow(/reviewer attribution/i);

    expect(await readLedger(runId)).toContainEqual(
      expect.objectContaining({
        type: "GUARD_BLOCKED",
        stage: "visuals-hosted-reopen",
        message: expect.stringMatching(/reviewer attribution/i),
      }),
    );
  });

  it("records a stale manifest expectation as a blocked guard", async () => {
    const runId = await prepareApprovedHostedVisualRun();

    await expect(
      prepareHostedVisualGenerationPlan({
        ...(await currentVisualExpectation(runId)),
        expectedManifestDigest: "e".repeat(64),
        runId,
        purpose: "regenerate-rejected",
        sceneIndexes: [1],
        reviewedBy: "visual director",
        reason: "Stale manifest expectation must be blocked.",
      }),
    ).rejects.toThrow(/visual manifest changed/i);

    expect(await readLedger(runId)).toContainEqual(
      expect.objectContaining({
        type: "GUARD_BLOCKED",
        stage: "visuals-hosted-reopen",
        message: expect.stringMatching(/visual manifest changed/i),
      }),
    );
  });
});
