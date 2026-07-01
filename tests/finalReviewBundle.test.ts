import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOperatorDeskViewModel, formatOperatorDeskPlain } from "../src/cli/operatorDeskModel";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import {
  createFinalReviewBundle,
  finalReviewBundleJsonPath,
  finalReviewBundleMarkdownPath,
  type FinalReviewBundle,
} from "../src/stages/finalReviewBundle";
import { recordRenderDecision, renderDecisionArtifactPaths } from "../src/stages/renderDecision";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";

const repoRoot = process.cwd();

describe("local final review bundle", () => {
  useTempProject();

  it("creates a decision-pending local review handoff after draft render", async () => {
    const runId = await renderLocalDraft("final-review-pending");

    const bundle = await createFinalReviewBundle(runId);

    expect(bundle).toMatchObject({
      runId,
      schemaVersion: 1,
      status: "decision-pending",
      renderDecision: {
        kind: "missing",
        nextAction: expect.stringContaining(`--run ${runId}`),
      },
      draftRender: {
        path: "production/render/draft.mp4",
        reviewPath: "production/render/draft_review.md",
        manifestPath: "production/render/render_manifest.json",
        media: { audioCodec: "aac", videoCodec: "h264", width: 1280, height: 720 },
      },
      voiceover: {
        path: "production/audio/voiceover.wav",
        productionVoiceCandidate: false,
      },
    });
    expect(bundle.artifacts.map((artifact) => artifact.path)).toEqual(
      expect.arrayContaining([
        "script.md",
        "production/production_package.md",
        "production/storyboard_contact_sheet.md",
        "production/audio/voiceover_review.md",
        "production/render/draft.mp4",
        "production/render/draft_review.md",
        "evidence_bundle.md",
        "diagnostics/readiness.md",
      ]),
    );
    expect(bundle.nextSafeAction).toContain("producer decide render");
    expect(bundle.blockedActions.join(" ").toLowerCase()).toContain("upload");

    const run = await loadRun(runId);
    expect(run.state).toBe("RENDERED");
    expect(run.artifacts).toEqual(
      expect.arrayContaining([finalReviewBundleJsonPath, finalReviewBundleMarkdownPath]),
    );
    const markdown = await readFile(artifactPath(runId, finalReviewBundleMarkdownPath), "utf8");
    expect(markdown).toContain("# Local Final Review Handoff");
    expect(markdown).toContain("Decision: pending");
    expect(markdown.toLowerCase()).toContain("upload");
    expect(markdown.toLowerCase()).toContain("publish");
  });

  it("includes a trusted recorded render decision when one exists", async () => {
    const runId = await renderLocalDraft("final-review-accepted");
    await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Draft is acceptable for local channel review.",
      reviewedBy: "operator",
      runId,
    });

    const bundle = await createFinalReviewBundle(runId);

    expect(bundle).toMatchObject({
      status: "accepted-for-local-review",
      renderDecision: {
        kind: "present",
        decision: "accepted-for-local-review",
        reviewedBy: "operator",
        reviewCommand: `pnpm producer review render-decision --run ${runId}`,
      },
      nextSafeAction: expect.stringContaining(`pnpm producer review-bundle --run ${runId}`),
    });
    expect(bundle.artifacts.map((artifact) => artifact.path)).toContain(
      "production/render/render_decision.md",
    );
    const markdown = await readFile(artifactPath(runId, finalReviewBundleMarkdownPath), "utf8");
    expect(markdown).toContain("Decision: accepted-for-local-review");
    expect(markdown).toContain("Draft is acceptable for local channel review.");
  });

  it("fails closed instead of bundling stale render-decision evidence", async () => {
    const runId = await renderLocalDraft("final-review-stale-decision");
    const decision = await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Draft is acceptable.",
      reviewedBy: "operator",
      runId,
    });
    await writeFile(
      renderDecisionArtifactPaths(runId).json,
      JSON.stringify({
        ...decision,
        draftRender: { ...decision.draftRender, sha256: "f".repeat(64) },
      }),
      "utf8",
    );

    await expect(createFinalReviewBundle(runId)).rejects.toThrow(/different draft render digest/);
  });

  it("prints parseable CLI JSON and persists the bundle artifacts", async () => {
    const runId = await renderLocalDraft("final-review-cli");

    const result = runCli(["review-bundle", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    const bundle = JSON.parse(result.stdout) as FinalReviewBundle;
    expect(bundle).toMatchObject({
      runId,
      status: "decision-pending",
      draftRender: { path: "production/render/draft.mp4" },
    });
    await expect(
      readFile(artifactPath(runId, finalReviewBundleJsonPath), "utf8"),
    ).resolves.toContain('"status": "decision-pending"');
  });

  it("surfaces the ready final review handoff in status and operator desk output", async () => {
    const runId = await renderLocalDraft("final-review-status");
    await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Draft is acceptable for local channel review.",
      reviewedBy: "operator",
      runId,
    });
    await createFinalReviewBundle(runId);

    const status = await readRunStatus(runId);
    const statusOutput = formatRunStatus(status);
    const deskOutput = formatOperatorDeskPlain(await buildOperatorDeskViewModel({ runId }));

    expect(status.finalReviewBundle).toMatchObject({
      kind: "present",
      bundle: { status: "accepted-for-local-review" },
      reviewPath: "production/review_bundle.md",
    });
    expect(status.nextRecommendedCommand).toContain("Local final review handoff is ready");
    expect(status.nextRecommendedCommand).not.toContain("producer review-bundle");
    expect(statusOutput).toContain("Final review bundle: accepted-for-local-review");
    expect(statusOutput).toContain("Final review bundle artifact: production/review_bundle.md");
    expect(deskOutput).toContain("Final review bundle: accepted-for-local-review");
    expect(deskOutput).toContain("Final review bundle artifact: production/review_bundle.md");
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    [path.join(repoRoot, "src", "cli.ts"), ...args],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  return {
    status: result.status,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}
