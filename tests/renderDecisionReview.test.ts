import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { recordRenderDecision } from "../src/stages/renderDecision";
import type { RenderDecisionReviewHandoff } from "../src/stages/reviewRenderDecision";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";

const repoRoot = process.cwd();

describe("render-decision review command", () => {
  useTempProject();

  it("prints the validated recorded render decision for local review", async () => {
    const runId = await renderLocalDraft("decision-review");
    await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Timing, overlays, and intro outro are acceptable for local channel review.",
      reviewedBy: "operator",
      runId,
    });

    const review = runCli(["review", "render-decision", "--run", runId]);
    expect(review.status).toBe(0);
    expect(review.stdout).toContain(`Run: ${runId}`);
    expect(review.stdout).toContain("Decision: accepted-for-local-review");
    expect(review.stdout).toContain("Decision artifact: production/render/render_decision.json");
    expect(review.stdout).toContain(
      "Decision review document: production/render/render_decision.md",
    );
    expect(review.stdout).toContain("Upload remains disabled");

    const reviewJson = runCli(["review", "render-decision", "--run", runId, "--json"]);
    expect(reviewJson.status).toBe(0);
    expect(JSON.parse(reviewJson.stdout) as RenderDecisionReviewHandoff).toMatchObject({
      decision: "accepted-for-local-review",
      renderDecisionMarkdownPath: "production/render/render_decision.md",
      renderDecisionPath: "production/render/render_decision.json",
      reviewedBy: "operator",
      runId,
    });
  });

  it("blocks before a render decision exists", async () => {
    const runId = await renderLocalDraft("decision-review-missing");

    const result = runCli(["review", "render-decision", "--run", runId]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Render decision review requires a recorded operator decision");
    expect(result.stderr).toContain(`pnpm producer decide render --run ${runId}`);
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
