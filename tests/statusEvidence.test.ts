import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun, saveRun } from "../src/core/runStore";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";
import { studioEvidenceFixture } from "./studioRunFixtures";

describe("status evidence validity", () => {
  useTempProject();

  it("labels production media as artifact-record fallback when evidence is missing", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["production/render_plan.json"],
      state: "PRODUCTION_PACKAGE_GENERATED",
    });

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Evidence: missing");
    expect(output).toContain(
      "Production media evidence: artifact-record fallback because evidence is missing.",
    );
    expect(output).toContain(
      "Regenerate evidence before treating production media rows as review proof.",
    );
    expect(output).toContain(
      `Production media evidence action: pnpm producer evidence --run ${run.runId}`,
    );
    expect(output).toContain("- Render plan: recorded");
  });

  it("labels production media as current evidence when evidence is valid", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["production/render_plan.json", "evidence_bundle.json"],
      state: "PRODUCTION_PACKAGE_GENERATED",
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(run.runId, "PRODUCTION_PACKAGE_GENERATED", {
          nextRecommendedCommand: "pnpm producer estimate --run <run_id>",
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

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Evidence: available");
    expect(output).toContain("Production media evidence: current evidence bundle.");
    expect(output).not.toContain("artifact-record fallback");
    expect(output).toContain("- Render plan: pass (11 assets, 3 artifacts)");
  });

  it("marks evidence generated for a previous run state as stale", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["evidence_bundle.json"],
      state: "SCRIPT_APPROVED",
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(run.runId, "SCRIPT_REVIEWED", {
          nextRecommendedCommand: "pnpm producer approve script --run <run_id>",
        }),
      ),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Evidence: stale (evidence_bundle.json was generated for SCRIPT_REVIEWED, but the run is SCRIPT_APPROVED.)",
    );
    expect(output).toContain(`Evidence next action: pnpm producer evidence --run ${run.runId}`);
    expect(output).toContain(
      "Production media evidence: artifact-record fallback because evidence is stale.",
    );
    expect(output).toContain(`Next safe action: pnpm producer evidence --run ${run.runId}`);
  });

  it("marks unreadable evidence JSON as invalid instead of missing", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}`, { recursive: true });
    await writeFile(artifactPath(run.runId, "evidence_bundle.json"), "{", "utf8");

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Evidence: invalid (evidence_bundle.json could not be parsed.)");
    expect(output).toContain(`Evidence next action: pnpm producer evidence --run ${run.runId}`);
    expect(output).toContain(
      "Production media evidence: artifact-record fallback because evidence is invalid.",
    );
  });
});
