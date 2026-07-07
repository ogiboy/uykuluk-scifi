import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractRunId, productFileExists } from "./product-uat-helpers.mjs";

/**
 * Creates a run with generated ideas but no approval.
 *
 * @param {Object} input - Scenario input.
 * @param {string} input.pnpm - The package runner executable.
 * @param {(args: string[], options: Object) => {stdout: string, stderr: string}} input.run - Command runner.
 * @param {string} input.scenario - Scenario label for the report.
 * @returns {Promise<string>} The created run id.
 */
export async function createIdeaOnlyRun({ pnpm, run, scenario }) {
  const ideas = run([pnpm, "producer", "ideas"], { label: "generate ideas", scenario });
  return extractRunId(ideas.stdout);
}

/**
 * Drives the CLI to a local voiceover-ready run.
 *
 * @param {Object} input - Scenario input.
 * @param {(condition: boolean, label: string, scenario: string) => void} [input.assertCondition] - Optional assertion recorder.
 * @param {string} input.pnpm - The package runner executable.
 * @param {(args: string[], options: Object) => {stdout: string, stderr: string}} input.run - Command runner.
 * @param {string} input.scenario - Scenario label for the report.
 * @param {string} input.workdir - Isolated workdir containing the generated run.
 * @returns {Promise<string>} The created run id.
 */
export async function createVoiceReadyRun({ assertCondition, pnpm, run, scenario, workdir }) {
  const runId = await createIdeaOnlyRun({ pnpm, run, scenario });
  const ideas = JSON.parse(await readFile(path.join(workdir, "runs", runId, "ideas.json"), "utf8"));
  const ideaId = ideas.ideas[0].id;
  run([pnpm, "producer", "approve", "idea", "--run", runId, "--idea", ideaId], {
    label: "approve idea",
    scenario,
  });
  run([pnpm, "producer", "script", "--run", runId], { label: "generate script", scenario });
  run([pnpm, "producer", "review", "script", "--run", runId], { label: "review script", scenario });
  run([pnpm, "producer", "approve", "script", "--run", runId, "--acknowledge-warnings"], {
    label: "approve script with warning acknowledgement",
    scenario,
  });
  run([pnpm, "producer", "package", "--run", runId], { label: "generate package", scenario });
  run([pnpm, "producer", "render-plan", "--run", runId], {
    label: "generate render plan",
    scenario,
  });
  const renderPlanReview = run([pnpm, "producer", "review", "render-plan", "--run", runId], {
    expectOutput: "Contact sheet:",
    label: "render-plan review handoff is available",
    scenario,
  });
  assertCondition?.(
    renderPlanReview.stdout.includes("Bookends:") &&
      renderPlanReview.stdout.includes("Scene asset map:"),
    "render-plan review shows bookends and scene asset map",
    scenario,
  );
  assertCondition?.(
    renderPlanReview.stdout.includes("assets/intro/frames/intro_frame_00.jpg") &&
      renderPlanReview.stdout.includes("assets/outro/frames/outro_frame_00.jpg"),
    "render-plan review shows committed source-frame paths",
    scenario,
  );
  run([pnpm, "producer", "estimate", "--run", runId], { label: "estimate cost", scenario });
  run([pnpm, "producer", "evidence", "--run", runId], { label: "generate evidence", scenario });
  run([pnpm, "producer", "readiness", "--run", runId], {
    expectOutput: "Readiness passed",
    label: "readiness passes",
    scenario,
  });
  run([pnpm, "producer", "voice", "--run", runId], {
    expectOutput: "Voiceover generated",
    label: "generate deterministic voiceover",
    scenario,
  });
  const voiceReview = run([pnpm, "producer", "review", "voice", "--run", runId], {
    expectOutput: "Production voice candidate: false",
    label: "voiceover review handoff is available",
    scenario,
  });
  assertCondition?.(
    voiceReview.stdout.includes("Render approval scope: timing-draft-only"),
    "voiceover review marks deterministic audio as timing draft only",
    scenario,
  );
  assertCondition?.(
    voiceReview.stdout.includes(
      `Render approval command: pnpm producer approve render --run ${runId}`,
    ),
    "voiceover review prints exact render approval command",
    scenario,
  );
  return runId;
}

/**
 * Verifies manual analytics import, report refresh, and malformed-input safety.
 *
 * @param {Object} input - Scenario input.
 * @param {(condition: boolean, label: string, scenario: string) => void} input.assertCondition - Assertion recorder.
 * @param {(relativePath: string, label: string) => Promise<void>} input.assertFile - File assertion helper.
 * @param {string} input.pnpm - The package runner executable.
 * @param {(args: string[], options: Object) => {stdout: string, stderr: string}} input.run - Command runner.
 * @param {string} input.runId - Run id to link one imported performance row.
 * @param {string} input.workdir - Isolated workdir containing analytics artifacts.
 */
export async function runManualAnalyticsSmoke({
  assertCondition,
  assertFile,
  pnpm,
  run,
  runId,
  workdir,
}) {
  await writeFile(
    path.join(workdir, "bad-performance.json"),
    JSON.stringify([{ title: "missing video id" }]),
    "utf8",
  );
  run([pnpm, "producer", "analytics", "import", "--file", "bad-performance.json"], {
    expectFailure: true,
    label: "malformed analytics import is rejected",
    scenario: "analytics feedback",
  });
  assertCondition(
    !productFileExists({ relativePath: "analytics/performance.json", workdir }),
    "malformed analytics import writes no dataset",
    "analytics feedback",
  );

  await writeFile(
    path.join(workdir, "performance.csv"),
    [
      "run_id,video_id,title,published_at,impressions,views,ctr,avg_view_duration_seconds,avg_percentage_viewed,subscribers_gained,likes,comments,notes",
      `${runId},yt_rendered,"Rendered Draft Review",2026-06-29T12:00:00.000Z,10000,1250,7.4%,181,42%,12,90,8,"Strong retention candidate"`,
      ',yt_unmapped,"Unmapped Topic",2026-06-29T13:00:00.000Z,3000,90,1.8%,35,12%,0,4,1,"Needs run link"',
    ].join("\n"),
    "utf8",
  );
  run([pnpm, "producer", "analytics", "import", "--file", "performance.csv"], {
    expectOutput: "Analytics imported. Records: 2",
    label: "analytics CSV import writes local artifacts",
    scenario: "analytics feedback",
  });
  await assertFile("analytics/performance.json", "analytics dataset exists");
  await assertFile("analytics/performance_report.md", "analytics report exists");
  await assertFile("analytics/run_link_template.csv", "analytics run-link template exists");
  run([pnpm, "producer", "analytics", "report"], {
    expectOutput: "No causal claims are made from this import.",
    label: "analytics report prints non-causal guidance",
    scenario: "analytics feedback",
  });

  const reportPath = path.join(workdir, "analytics", "performance_report.md");
  await writeFile(reportPath, "# stale report\n", "utf8");
  run([pnpm, "producer", "analytics", "report"], {
    expectOutput: "Manual Analytics Report",
    label: "analytics report refreshes stale markdown",
    scenario: "analytics feedback",
  });
  const refreshedReport = await readFile(reportPath, "utf8");
  assertCondition(
    refreshedReport.includes("Manual Analytics Report") &&
      !refreshedReport.includes("# stale report"),
    "analytics report artifact is regenerated",
    "analytics feedback",
  );
}

/**
 * Verifies that stale evidence is visible and recoverable by regeneration.
 *
 * @param {Object} input - Scenario input.
 * @param {string} input.pnpm - The package runner executable.
 * @param {(args: string[], options: Object) => {stdout: string, stderr: string}} input.run - Command runner.
 * @param {string} input.runId - Rendered run id.
 * @param {string} input.workdir - Isolated workdir containing the evidence bundle.
 */
export async function assertStaleEvidenceRecovery({ pnpm, run, runId, workdir }) {
  const target = path.join(workdir, "runs", runId, "evidence_bundle.json");
  const evidence = JSON.parse(await readFile(target, "utf8"));
  evidence.currentState = "NEW";
  await writeFile(target, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  run([pnpm, "producer", "status", "--run", runId], {
    expectOutput: "Evidence: stale",
    label: "status marks stale evidence",
    scenario: "stale evidence",
  });
  run([pnpm, "producer", "evidence", "--run", runId], {
    label: "regenerate evidence",
    scenario: "stale evidence",
  });
  run([pnpm, "producer", "status", "--run", runId], {
    expectOutput: "Evidence: available",
    label: "status accepts regenerated evidence",
    scenario: "stale evidence",
  });
}

/**
 * Verifies that tampered render review commands are not trusted.
 *
 * @param {Object} input - Scenario input.
 * @param {string} input.pnpm - The package runner executable.
 * @param {(args: string[], options: Object) => {stdout: string, stderr: string}} input.run - Command runner.
 * @param {string} input.runId - Rendered run id.
 * @param {string} input.workdir - Isolated workdir containing the render manifest.
 */
export async function assertTamperedRenderReviewCommandBlocks({ pnpm, run, runId, workdir }) {
  const target = path.join(workdir, "runs", runId, "production", "render", "render_manifest.json");
  const manifest = JSON.parse(await readFile(target, "utf8"));
  manifest.ffmpeg.reviewCommand = "echo tampered";
  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  run([pnpm, "producer", "review", "render", "--run", runId], {
    expectFailure: true,
    expectOutput: "Draft render review is blocked",
    label: "tampered render review command is rejected",
    scenario: "tamper",
  });
}

/**
 * Verifies channel handoff refuses stale or invalid final-review evidence without writing handoff artifacts.
 *
 * @param {Object} input - Scenario input.
 * @param {(condition: boolean, label: string, scenario: string) => void} input.assertCondition - Assertion recorder.
 * @param {string} input.pnpm - The package runner executable.
 * @param {(args: string[], options: Object) => {stdout: string, stderr: string}} input.run - Command runner.
 * @param {string} input.runId - Rendered run id with a final review bundle.
 * @param {string} input.workdir - Isolated workdir containing the final-review bundle.
 */
export async function assertTamperedFinalReviewBlocksChannelHandoff({
  assertCondition,
  pnpm,
  run,
  runId,
  workdir,
}) {
  const target = path.join(workdir, "runs", runId, "production", "review_bundle.json");
  const original = await readFile(target, "utf8");
  const bundle = JSON.parse(original);
  bundle.runId = "tampered-run";
  await writeFile(target, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  run([pnpm, "producer", "channel-handoff", "--run", runId], {
    expectFailure: true,
    expectOutput: "trusted final review bundle",
    label: "channel handoff rejects tampered final review",
    scenario: "tamper",
  });
  assertCondition(
    !productFileExists({
      relativePath: path.join("runs", runId, "production", "channel_handoff.json"),
      workdir,
    }) &&
      !productFileExists({
        relativePath: path.join("runs", runId, "production", "channel_handoff.md"),
        workdir,
      }),
    "tampered final review writes no channel handoff artifacts",
    "tamper",
  );
  await writeFile(target, original, "utf8");
}

/**
 * Verifies the expected rendered artifacts exist.
 *
 * @param {Object} input - Scenario input.
 * @param {(relativePath: string, label: string) => Promise<void>} input.assertFile - File assertion helper.
 * @param {string} input.runId - Rendered run id.
 */
export async function assertRenderedArtifacts({ assertFile, runId }) {
  for (const artifact of [
    "production/render_plan.json",
    "production/storyboard_contact_sheet.md",
    "production/asset_provenance.json",
    "production/audio/voiceover.wav",
    "production/audio/voiceover.meta.json",
    "production/audio/voiceover_review.md",
    "production/render/draft.mp4",
    "production/render/render_manifest.json",
    "production/render/draft_review.md",
    "production/render/youtube_chapters.json",
    "production/render/youtube_chapters.md",
    "production/render/render_decision.json",
    "production/render/render_decision.md",
    "production/review_bundle.json",
    "production/review_bundle.md",
    "production/thumbnail_candidates.json",
    "production/thumbnail_candidates.md",
    "production/channel_handoff.json",
    "production/channel_handoff.md",
  ]) {
    await assertFile(path.join("runs", runId, artifact), `rendered artifact exists: ${artifact}`);
  }
}
