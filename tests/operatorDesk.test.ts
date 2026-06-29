import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOperatorDeskViewModel, formatOperatorDeskPlain } from "../src/cli/operatorDeskModel";
import { shouldUsePlainOperatorDeskOutput } from "../src/cli/operatorDeskRunner";
import { artifactPath } from "../src/core/artifacts";
import { createRun, saveRun } from "../src/core/runStore";
import { recordRenderDecision } from "../src/stages/renderDecision";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";
import { manualProductionEvidence, passingRenderedEvidence } from "./statusOutputEvidenceFixtures";

const repoRoot = process.cwd();

describe("operator desk", () => {
  useTempProject();

  it("recommends idea generation when no runs exist", async () => {
    const model = await buildOperatorDeskViewModel();

    expect(model).toMatchObject({
      latestRunId: null,
      runDetails: [],
      runs: [],
      selectedRun: null,
    });
    expect(formatOperatorDeskPlain(model)).toContain("Next safe action: pnpm producer ideas");
  });

  it("shows the selected run and next safe action without mutating state", async () => {
    const first = await createRun();
    const second = await createRun();

    const model = await buildOperatorDeskViewModel({ runId: first.runId });

    expect(model.latestRunId).toBe(second.runId);
    expect(model.selectedRun).toMatchObject({
      evidenceStatus: "missing",
      nextRecommendedCommand: "pnpm producer ideas",
      readinessStatus: "missing",
      renderDecisionStatus: "missing",
      runId: first.runId,
      state: "NEW",
    });
    expect(model.runDetails.map((run) => run.runId)).toContain(first.runId);
    expect(formatOperatorDeskPlain(model)).toContain(`Selected run: ${first.runId}`);
    expect(formatOperatorDeskPlain(model)).toContain("Render decision: missing");
  });

  it("prints a scriptable plain CLI summary", async () => {
    const run = await createRun();
    const result = spawnSync(
      path.join(repoRoot, "node_modules", ".bin", "tsx"),
      [path.join(repoRoot, "src", "cli.ts"), "desk", "--run", run.runId, "--plain"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("UykulukSciFi Operator Desk");
    expect(result.stdout).toContain(`Selected run: ${run.runId}`);
    expect(result.stdout).toContain("Next safe action:");
  });

  it("opens the operator desk when the root producer command has no subcommand", () => {
    const result = spawnSync(
      path.join(repoRoot, "node_modules", ".bin", "tsx"),
      [path.join(repoRoot, "src", "cli.ts")],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("UykulukSciFi Operator Desk");
    expect(result.stdout).toContain("Next safe action:");
  });

  it("falls back to plain output when either terminal stream is non-interactive", () => {
    expect(shouldUsePlainOperatorDeskOutput({}, { stdinIsTTY: false, stdoutIsTTY: true })).toBe(
      true,
    );
    expect(shouldUsePlainOperatorDeskOutput({}, { stdinIsTTY: true, stdoutIsTTY: false })).toBe(
      true,
    );
    expect(shouldUsePlainOperatorDeskOutput({}, { stdinIsTTY: true, stdoutIsTTY: true })).toBe(
      false,
    );
  });

  it("surfaces media review commands in operator desk output", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: [
        "production/render_plan.json",
        "production/audio/voiceover.wav",
        "production/render/draft.mp4",
        "evidence_bundle.json",
      ],
      state: "RENDERED",
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(passingRenderedEvidence(run.runId)),
      "utf8",
    );

    const output = formatOperatorDeskPlain(await buildOperatorDeskViewModel({ runId: run.runId }));

    expect(output).toContain(
      `- Render plan: pass (11 assets, 3 artifacts) | Review command: pnpm producer review render-plan --run ${run.runId}`,
    );
    expect(output).toContain(
      `- Voiceover audio: pass (8s, local-piper, production voice candidate, 42 source words) | Review command: pnpm producer review voice --run ${run.runId}`,
    );
    expect(output).toContain(
      `- Draft render: pass (8s, intro -> scene -> outro, source frames intro:2/outro:2, frame cadence intro#1=1s assets/intro/frames/intro_frame_00.jpg; intro#2=1s assets/intro/frames/intro_frame_01.jpg; outro#1=1.5s assets/outro/frames/outro_frame_00.jpg; outro#2=1.5s assets/outro/frames/outro_frame_01.jpg, voiceover local-piper production candidate, approval approval_render_status, ffprobe 1280x720 audio) | Review command: pnpm producer review render --run ${run.runId}`,
    );
  });

  it("surfaces readiness attention and blocked action details in operator desk output", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["diagnostics/readiness.json", "evidence_bundle.json"],
      state: "READY_FOR_MANUAL_PRODUCTION",
    });
    await mkdir(path.dirname(artifactPath(run.runId, "diagnostics/readiness.json")), {
      recursive: true,
    });
    await writeFile(
      artifactPath(run.runId, "diagnostics/readiness.json"),
      JSON.stringify({
        checks: [
          {
            message: "Local voiceover audio is missing.",
            name: "voiceover",
            nextAction: "pnpm producer voice --run <run_id>",
            status: "block",
          },
          {
            message: "Upload remains disabled.",
            name: "publish-safety",
            status: "warn",
          },
        ],
        currentState: "READY_FOR_MANUAL_PRODUCTION",
        passed: false,
        runId: run.runId,
      }),
      "utf8",
    );
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(manualProductionEvidence(run.runId)),
      "utf8",
    );

    const output = formatOperatorDeskPlain(await buildOperatorDeskViewModel({ runId: run.runId }));

    expect(output).toContain("Readiness: blocked (2 checks, 1 block, 1 warn)");
    expect(output).toContain("- voiceover [block]: Local voiceover audio is missing.");
    expect(output).toContain(`Next action: pnpm producer voice --run ${run.runId}`);
    expect(output).toContain("Blocked action details:");
    expect(output).toContain("TTS disabled until configured and approved.");
  });

  it("surfaces the concrete render decision in recent run summaries", async () => {
    const runId = await renderLocalDraft("operator-desk-decision");
    await recordRenderDecision({
      decision: "needs-revision",
      notes: "Subtitle timing needs one more local pass.",
      reviewedBy: "operator",
      runId,
    });

    const model = await buildOperatorDeskViewModel({ runId });
    const output = formatOperatorDeskPlain(model);

    expect(model.selectedRun).toMatchObject({
      renderDecisionStatus: "needs-revision by operator",
      runId,
    });
    expect(output).toContain(`> ${runId}  RENDERED`);
    expect(output).toContain("decision:needs-revision by operator");
    expect(output).not.toContain("decision:present");
  });

  it("rejects ambiguous run selection", async () => {
    const run = await createRun();

    await expect(buildOperatorDeskViewModel({ latest: true, runId: run.runId })).rejects.toThrow(
      "Use either --run or --latest, not both.",
    );
  });
});
