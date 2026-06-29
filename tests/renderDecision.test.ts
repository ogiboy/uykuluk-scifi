import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { createRun, loadRun } from "../src/core/runStore";
import { approveRender } from "../src/stages/approveRender";
import { renderDraft } from "../src/stages/render";
import type { RenderDecisionRecord } from "../src/stages/renderDecision";
import { useTempProject } from "./helpers";
import { prepareVoiceoverReadyRun } from "./renderPipelineHelpers";
import { createFakeFfmpeg, createFakeFfprobe, renderToolRoot } from "./renderTestHelpers";

const repoRoot = process.cwd();

describe("render operator decision", () => {
  useTempProject();

  it("records a durable decision after local draft-render review without upload approval", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    await renderDraft(runId, {
      ffmpegBinary: await createFakeFfmpeg(renderToolRoot("decision")),
      ffprobeBinary: await createFakeFfprobe(renderToolRoot("decision")),
      maxDurationSeconds: 8,
    });

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
