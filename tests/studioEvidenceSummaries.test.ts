import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getStudioRunDetail, listStudioRuns } from "../apps/studio/src/lib/runSummaries";
import { artifactPath } from "../src/core/artifacts";
import { createRun, saveRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";
import { studioEvidenceFixture } from "./studioRunFixtures";

describe("Studio evidence summary validity", () => {
  useTempProject();

  it("marks evidence generated for an older run state as stale", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["evidence_bundle.json", "production/render_plan.json"],
      state: "SCRIPT_APPROVED",
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(run.runId, "SCRIPT_REVIEWED", {
          blockedActions: ["TTS disabled until configured and approved."],
          nextRecommendedCommand: "pnpm producer approve script --run <run_id>",
          renderPlan: {
            artifactCount: 3,
            assetCount: 11,
            digest: "a".repeat(64),
            path: "production/render_plan.json",
            status: "pass",
          },
        }),
      ),
      "utf8",
    );

    const detail = await getStudioRunDetail(run.runId);

    expect(detail).toMatchObject({
      blockedActions: [],
      evidence: null,
      evidenceMessage:
        "Evidence bundle was generated for SCRIPT_REVIEWED, but the run is SCRIPT_APPROVED.",
      evidenceNextAction: `pnpm producer evidence --run ${run.runId}`,
      evidenceStatus: "stale",
      nextRecommendedCommand: `pnpm producer evidence --run ${run.runId}`,
    });
    expect(detail?.productionMedia[0]).toMatchObject({
      artifactPath: "production/render_plan.json",
      detail: "artifact record only; regenerate evidence to verify current media",
      status: "recorded",
    });
  });

  it("marks unreadable evidence JSON as invalid instead of missing", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}`, { recursive: true });
    await writeFile(artifactPath(run.runId, "evidence_bundle.json"), "{", "utf8");

    const detail = await getStudioRunDetail(run.runId);

    expect(detail).toMatchObject({
      evidence: null,
      evidenceMessage: "Evidence bundle could not be parsed.",
      evidenceNextAction: `pnpm producer evidence --run ${run.runId}`,
      evidenceStatus: "invalid",
      nextRecommendedCommand: `pnpm producer evidence --run ${run.runId}`,
    });
  });

  it("keeps early workflow guidance when evidence is missing", async () => {
    const run = await createRun();

    const detail = await getStudioRunDetail(run.runId);

    expect(detail).toMatchObject({
      evidence: null,
      evidenceMessage: "Evidence bundle has not been generated.",
      evidenceNextAction: `pnpm producer evidence --run ${run.runId}`,
      evidenceStatus: "missing",
      nextRecommendedCommand: "pnpm producer ideas",
    });
  });

  it("surfaces stale evidence status in run index summaries", async () => {
    const run = await createRun();
    await saveRun({ ...run, artifacts: ["evidence_bundle.json"], state: "SCRIPT_APPROVED" });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(run.runId, "SCRIPT_REVIEWED", {
          nextRecommendedCommand: "pnpm producer approve script --run <run_id>",
        }),
      ),
      "utf8",
    );

    const summaries = await listStudioRuns();

    expect(summaries[0]).toMatchObject({
      blockedActionCount: 0,
      evidenceMessage:
        "Evidence bundle was generated for SCRIPT_REVIEWED, but the run is SCRIPT_APPROVED.",
      evidenceNextAction: `pnpm producer evidence --run ${run.runId}`,
      evidenceStatus: "stale",
      nextRecommendedCommand: `pnpm producer evidence --run ${run.runId}`,
    });
  });
});
