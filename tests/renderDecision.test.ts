import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { createRun, loadRun } from "../src/core/runStore";
import {
  recordRenderDecision,
  renderDecisionArtifactPaths,
  type RenderDecisionRecord,
} from "../src/stages/renderDecision";
import {
  renderDecisionCommandTemplates,
  renderDecisionJsonPath,
  renderDecisionMarkdownPath,
} from "../src/stages/renderDecisionCommands";
import { readRenderDecisionStatus } from "../src/stages/renderDecisionStatus";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";

const repoRoot = process.cwd();

describe("render operator decision", () => {
  useTempProject();

  it("builds bundle-safe local decision command templates", () => {
    const commands = renderDecisionCommandTemplates("run_template");

    expect(commands).toEqual([
      {
        command:
          "pnpm producer decide render --run run_template --decision accepted-for-local-review --notes '<operator notes>' --reviewed-by operator",
        decision: "accepted-for-local-review",
        guidance: expect.stringContaining("complete local draft"),
      },
      {
        command:
          "pnpm producer decide render --run run_template --decision needs-revision --notes '<operator notes>' --reviewed-by operator",
        decision: "needs-revision",
        guidance: expect.stringContaining("another pass"),
      },
      {
        command:
          "pnpm producer decide render --run run_template --decision rejected --notes '<operator notes>' --reviewed-by operator",
        decision: "rejected",
        guidance: expect.stringContaining("should not be used"),
      },
    ]);
    expect(renderDecisionJsonPath).toBe("production/render/render_decision.json");
    expect(renderDecisionMarkdownPath).toBe("production/render/render_decision.md");
  });

  it("records a durable decision after local draft-render review without upload approval", async () => {
    const runId = await renderLocalDraft("decision");

    const result = runCli([
      "decide",
      "render",
      "--run",
      runId,
      "--decision",
      "accepted-for-local-review",
      "--notes",
      "Timing, overlays, and intro outro are acceptable for local channel review.",
      "--reviewed-by",
      "operator",
      "--json",
    ]);

    expect(result.status).toBe(0);
    const decision = JSON.parse(result.stdout) as RenderDecisionRecord;
    expect(decision).toMatchObject({
      decision: "accepted-for-local-review",
      nextSafeAction: expect.stringContaining("Upload remains disabled"),
      reviewedBy: "operator",
      runId,
      schemaVersion: 1,
    });
    expect(decision.draftRender.sha256).toMatch(/^[a-f0-9]{64}$/);

    const run = await loadRun(runId);
    expect(run.state).toBe("RENDERED");
    expect(run.artifacts).toEqual(
      expect.arrayContaining([
        "production/render/render_decision.json",
        "production/render/render_decision.md",
      ]),
    );
    await expect(
      readFile(artifactPath(runId, "production/render/render_decision.md"), "utf8"),
    ).resolves.toContain("Draft Render Operator Decision");
    const ledger = await readLedger(runId);
    expect(ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "decide-render",
          type: "REVIEW_DECISION_RECORDED",
        }),
      ]),
    );
    expect(run.approvals.map((approval) => approval.target)).not.toContain("upload");
    expect(run.approvals.map((approval) => approval.target)).not.toContain("publish");

    const status = await readRunStatus(runId);
    expect(status.renderDecision).toMatchObject({
      kind: "present",
      decision: { decision: "accepted-for-local-review", reviewedBy: "operator" },
    });
    expect(status.nextRecommendedCommand).toContain("Upload remains disabled");
    expect(formatRunStatus(status)).toContain(
      "Render decision: accepted-for-local-review by operator",
    );
  });

  it("blocks render decisions before a draft render exists", async () => {
    const run = await createRun();

    const result = runCli([
      "decide",
      "render",
      "--run",
      run.runId,
      "--decision",
      "needs-revision",
      "--notes",
      "No draft exists.",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Render decision requires state RENDERED");
  });

  it("records decision records directly for each safe local-review outcome", async () => {
    const acceptedRunId = await renderLocalDraft("direct-decision-accepted");
    const accepted = await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "  Draft timing is acceptable.  ",
      reviewedBy: "  operator  ",
      runId: acceptedRunId,
    });
    expect(accepted).toMatchObject({
      decision: "accepted-for-local-review",
      nextSafeAction: expect.stringContaining("Upload remains disabled"),
      notes: "Draft timing is acceptable.",
      reviewedBy: "operator",
      runId: acceptedRunId,
    });

    const needsRevisionRunId = await renderLocalDraft("direct-decision-needs-revision");
    const needsRevision = await recordRenderDecision({
      decision: "needs-revision",
      notes: "Subtitle timing needs another pass.",
      reviewedBy: "operator",
      runId: needsRevisionRunId,
    });
    expect(needsRevision.nextSafeAction).toContain("regenerate evidence/readiness");

    const rejectedRunId = await renderLocalDraft("direct-decision-rejected");
    const rejected = await recordRenderDecision({
      decision: "rejected",
      notes: "Do not use this draft.",
      reviewedBy: "operator",
      runId: rejectedRunId,
    });
    expect(rejected.nextSafeAction).toContain("Do not use this draft");

    await expect(
      readFile(renderDecisionArtifactPaths(acceptedRunId).markdown, "utf8"),
    ).resolves.toContain("## Still Blocked");
  });

  it("does not overwrite an existing render decision", async () => {
    const runId = await renderLocalDraft("decision-overwrite");
    await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Reviewed locally.",
      reviewedBy: "operator",
      runId,
    });

    await expect(
      recordRenderDecision({
        decision: "needs-revision",
        notes: "Second decision should not replace the durable first decision.",
        reviewedBy: "operator",
        runId,
      }),
    ).rejects.toThrow("Render decision already exists for this run");
  });

  it("reports missing, invalid, and stale render decisions fail-closed", async () => {
    const runId = await renderLocalDraft("decision-status");
    const run = await loadRun(runId);
    expect(await readRenderDecisionStatus(run)).toMatchObject({
      kind: "missing",
      nextAction: expect.stringContaining(`--run ${runId}`),
    });

    const decision = await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Reviewed locally.",
      reviewedBy: "operator",
      runId,
    });
    const decisionPath = renderDecisionArtifactPaths(runId).json;

    await writeFile(decisionPath, JSON.stringify({ ...decision, runId: "run_other" }), "utf8");
    expect(await readRenderDecisionStatus(run)).toMatchObject({
      kind: "stale",
      message: "Render decision belongs to a different run.",
    });

    await writeFile(decisionPath, JSON.stringify(decision), "utf8");
    expect(await readRenderDecisionStatus({ ...run, state: "ARCHIVED" })).toMatchObject({
      kind: "stale",
      message: `Render decision was recorded, but the run is ARCHIVED.`,
    });

    await writeFile(
      decisionPath,
      JSON.stringify({
        ...decision,
        draftRender: { ...decision.draftRender, sha256: "f".repeat(64) },
      }),
      "utf8",
    );
    expect(await readRenderDecisionStatus(run)).toMatchObject({
      kind: "stale",
      message: "Render decision was recorded for a different draft render digest.",
    });

    await writeFile(
      decisionPath,
      JSON.stringify({
        ...decision,
        renderApproval: { ...decision.renderApproval, approvalId: "approval_other" },
      }),
      "utf8",
    );
    expect(await readRenderDecisionStatus(run)).toMatchObject({
      kind: "stale",
      message: "Render decision was recorded for a different render approval.",
    });

    await writeFile(
      decisionPath,
      JSON.stringify({
        ...decision,
        renderApproval: { ...decision.renderApproval, approvedRef: "e".repeat(64) },
      }),
      "utf8",
    );
    expect(await readRenderDecisionStatus(run)).toMatchObject({
      kind: "stale",
      message: "Render decision was recorded for a different render approval ref.",
    });

    await writeFile(decisionPath, JSON.stringify({ schemaVersion: 1 }), "utf8");
    expect(await readRenderDecisionStatus(run)).toMatchObject({
      kind: "invalid",
      nextAction: expect.stringContaining(`--run ${runId}`),
    });
    expect(formatRunStatus(await readRunStatus(runId))).toContain("Render decision: invalid");
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
