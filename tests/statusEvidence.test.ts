import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun, saveRun } from "../src/core/runStore";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { ttsConfigurationDigest } from "../src/stages/voice/catalog/voiceAuditionRevision";
import { useTempProject } from "./helpers";
import { elevenLabsTtsConfig } from "./statusEvidenceFixtures";
import { studioEvidenceFixture } from "./studioRunFixtures";
import { configureElevenLabs } from "./voiceCatalogStageFixtures";

describe("status evidence validity", () => {
  useTempProject();
  afterEach(() => vi.useRealTimers());

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
    expect(output).toContain(`Next safe action: pnpm producer render-plan --run ${run.runId}`);
    expect(output).toContain(
      "- Render plan: recorded (artifact record only; regenerate evidence to verify current media)",
    );
    expect(output).toContain(
      "  Review: Regenerate evidence before using this media row as current review proof.",
    );
  });

  it("labels production media as current evidence when evidence is valid", async () => {
    const run = await createRun();
    const currentArtifacts = ["production/render_plan.json", "evidence_bundle.json"];
    await saveRun({ ...run, artifacts: currentArtifacts, state: "PRODUCTION_PACKAGE_GENERATED" });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(
          run.runId,
          "PRODUCTION_PACKAGE_GENERATED",
          {
            nextRecommendedCommand: "pnpm producer estimate --run <run_id>",
            renderPlan: {
              artifactCount: 3,
              assetCount: 11,
              digest: "a".repeat(64),
              path: "production/render_plan.json",
              status: "pass",
            },
          },
          currentArtifacts,
        ),
      ),
      "utf8",
    );

    const status = await readRunStatus(run.runId);
    const output = formatRunStatus(status);

    expect(output).toContain("Evidence: available");
    expect(output).toContain("Production media evidence: current evidence bundle.");
    expect(output).not.toContain("artifact-record fallback");
    expect(output).toContain("- Render plan: pass (11 assets, 3 artifacts)");
    expect(status.mediaArtifacts[0]?.facts).toEqual(["11 assets", "3 artifacts"]);
    expect(status.mediaArtifacts[0]?.reviewArtifactPath).toBe(
      "production/storyboard_contact_sheet.md",
    );
    expect(output).toContain(
      `  Review: Review with pnpm producer review render-plan --run ${run.runId}; confirm scene-to-asset mapping, bookend/source-frame paths, and the contact sheet before voiceover or render approval.`,
    );
  });

  it("marks evidence generated for a previous run state as stale", async () => {
    const run = await createRun();
    await saveRun({ ...run, artifacts: ["evidence_bundle.json"], state: "SCRIPT_APPROVED" });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(
          run.runId,
          "SCRIPT_REVIEWED",
          { nextRecommendedCommand: "pnpm producer approve script --run <run_id>" },
          run.artifacts,
        ),
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

  it("marks same-state evidence stale when the registered artifact set changes", async () => {
    await configureElevenLabs();
    const run = await createRun();
    const evidenceArtifacts = ["production/render_plan.json", "evidence_bundle.json"];
    const newSelectionPath = "production/audio/voice-selections/selection_002.json";
    await mkdir(artifactPath(run.runId, "production/audio/voice-selections"), { recursive: true });
    await writeFile(artifactPath(run.runId, newSelectionPath), "{}", "utf8");
    await saveRun({
      ...run,
      artifacts: [...evidenceArtifacts, newSelectionPath],
      state: "PRODUCTION_PACKAGE_GENERATED",
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(
          run.runId,
          "PRODUCTION_PACKAGE_GENERATED",
          {
            nextRecommendedCommand: "pnpm producer estimate --run <run_id>",
            ttsConfigurationDigest: ttsConfigurationDigest(elevenLabsTtsConfig()),
            voiceSelection: { status: "missing-or-invalid" },
          },
          evidenceArtifacts,
        ),
      ),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Evidence: stale (evidence_bundle.json does not match current voice audition evidence.)",
    );
    expect(output).toContain(`Next safe action: pnpm producer evidence --run ${run.runId}`);
  });
});
