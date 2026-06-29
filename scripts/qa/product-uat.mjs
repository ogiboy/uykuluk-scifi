import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertProductCondition,
  assertProductFile,
  createFakeMediaTools,
  enableDeterministicTts,
  extractRunId,
  prepareWorkspace,
  productFileExists,
  runProductCommand,
  writeProductUatReports,
} from "./product-uat-helpers.mjs";

const repoRoot = process.cwd();
const pnpm = process.env.PNPM_EXECUTABLE ?? "pnpm";
const startedAt = new Date();
const stamp = startedAt.toISOString().replaceAll(/[-:]/g, "").split(".")[0].replaceAll("T", "-");
const reportDir = path.join(repoRoot, ".ai", "qa", "artifacts", `product-uat-${stamp}`);
const scratchRoot = await mkdtemp(path.join(path.dirname(repoRoot), ".uykuluk-product-uat-"));
const workdir = path.join(scratchRoot, "project");
const steps = [];

await mkdir(reportDir, { recursive: true });

try {
  await prepareWorkspace({ repoRoot, workdir });
  run([pnpm, "install"], { label: "clean install", scenario: "setup" });
  run([pnpm, "producer", "init"], { label: "init creates config", scenario: "setup" });
  await enableDeterministicTts({ workdir });
  await assertFile("producer.config.json", "setup config exists");

  run([pnpm, "producer", "status", "--run", "../evil"], {
    expectFailure: true,
    expectOutput: "Invalid run id",
    label: "traversal-shaped run id is rejected",
    scenario: "malicious input",
  });

  const blockedRunId = await createIdeaOnlyRun("blocked-order");
  run([pnpm, "producer", "script", "--run", blockedRunId], {
    expectFailure: true,
    expectOutput: "requires state IDEA_APPROVED",
    label: "script is blocked before idea approval",
    scenario: "incorrect order",
  });
  run([pnpm, "producer", "package", "--run", blockedRunId], {
    expectFailure: true,
    expectOutput: "requires state SCRIPT_APPROVED",
    label: "package is blocked before script approval",
    scenario: "incorrect order",
  });

  const renderedRunId = await createVoiceReadyRun("happy-path");
  run([pnpm, "producer", "approve", "render", "--run", renderedRunId], {
    expectOutput: "Render approval recorded",
    label: "render approval binds current media inputs",
    scenario: "happy path",
  });
  const mediaTools = await createFakeMediaTools({ workdir });
  run([pnpm, "producer", "render", "--run", renderedRunId], {
    env: { PATH: `${mediaTools.binDir}${path.delimiter}${process.env.PATH ?? ""}` },
    expectOutput: "Draft render available",
    label: "local draft render completes with fake media tools",
    scenario: "happy path",
  });
  run([pnpm, "producer", "review", "render", "--run", renderedRunId], {
    expectOutput: "FFmpeg review command:",
    label: "render review handoff is available",
    scenario: "happy path",
  });
  run([pnpm, "producer", "status", "--run", renderedRunId], {
    expectOutput: "RENDERED",
    label: "status reaches rendered state",
    scenario: "happy path",
  });
  run([pnpm, "producer", "upload", "private", "--run", renderedRunId], {
    expectFailure: true,
    expectOutput: "requires explicit upload approval",
    label: "private upload stays blocked",
    scenario: "publish safety",
  });
  run([pnpm, "producer", "publish", "schedule", "--run", renderedRunId], {
    expectFailure: true,
    expectOutput: "requires explicit publish approval",
    label: "scheduled publish stays blocked",
    scenario: "publish safety",
  });
  await assertRenderedArtifacts(renderedRunId);
  await runManualAnalyticsSmoke(renderedRunId);
  await assertStaleEvidenceRecovery(renderedRunId);
  await assertTamperedRenderReviewCommandBlocks(renderedRunId);

  const tamperedRunId = await createVoiceReadyRun("tampered-render-input");
  run([pnpm, "producer", "approve", "render", "--run", tamperedRunId], {
    expectOutput: "Render approval recorded",
    label: "render approval recorded before input tamper",
    scenario: "tamper",
  });
  await appendFile(
    path.join(workdir, "runs", tamperedRunId, "production", "audio", "voiceover.wav"),
    "tampered",
    "utf8",
  );
  run([pnpm, "producer", "render", "--run", tamperedRunId], {
    env: { PATH: `${mediaTools.binDir}${path.delimiter}${process.env.PATH ?? ""}` },
    expectFailure: true,
    expectOutput: "Draft render requires valid voiceover audio evidence",
    label: "tampered voiceover blocks render after approval",
    scenario: "tamper",
  });

  await writeReports({ passed: true, runIds: [renderedRunId, tamperedRunId, blockedRunId] });
  console.log(
    `Product UAT passed. Report: ${path.relative(repoRoot, path.join(reportDir, "qa-report.md"))}`,
  );
} catch (error) {
  await writeReports({
    error: error instanceof Error ? error.message : String(error),
    passed: false,
  });
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await rm(scratchRoot, { force: true, recursive: true });
}

/**
 * Creates a run with generated ideas but no approval.
 *
 * @param {string} scenario - Scenario label for the report.
 * @returns {Promise<string>} The created run id.
 */
async function createIdeaOnlyRun(scenario) {
  const ideas = run([pnpm, "producer", "ideas"], {
    label: "generate ideas",
    scenario,
  });
  return extractRunId(ideas.stdout);
}

/**
 * Drives the CLI to a local voiceover-ready run.
 *
 * @param {string} scenario - Scenario label for the report.
 * @returns {Promise<string>} The created run id.
 */
async function createVoiceReadyRun(scenario) {
  const runId = await createIdeaOnlyRun(scenario);
  const ideas = JSON.parse(await readFile(path.join(workdir, "runs", runId, "ideas.json"), "utf8"));
  const ideaId = ideas.ideas[0].id;
  run([pnpm, "producer", "approve", "idea", "--run", runId, "--idea", ideaId], {
    label: "approve idea",
    scenario,
  });
  run([pnpm, "producer", "script", "--run", runId], { label: "generate script", scenario });
  run([pnpm, "producer", "review", "script", "--run", runId], {
    label: "review script",
    scenario,
  });
  run([pnpm, "producer", "approve", "script", "--run", runId, "--acknowledge-warnings"], {
    label: "approve script with warning acknowledgement",
    scenario,
  });
  run([pnpm, "producer", "package", "--run", runId], { label: "generate package", scenario });
  run([pnpm, "producer", "render-plan", "--run", runId], {
    label: "generate render plan",
    scenario,
  });
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
  return runId;
}

/**
 * Verifies manual analytics import, report refresh, and malformed-input safety.
 *
 * @param {string} runId - Run id to link one imported performance row.
 */
async function runManualAnalyticsSmoke(runId) {
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
 * @param {string} runId - Rendered run id.
 */
async function assertStaleEvidenceRecovery(runId) {
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
 * @param {string} runId - Rendered run id.
 */
async function assertTamperedRenderReviewCommandBlocks(runId) {
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
 * Verifies the expected rendered artifacts exist.
 *
 * @param {string} runId - Rendered run id.
 */
async function assertRenderedArtifacts(runId) {
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
  ]) {
    await assertFile(path.join("runs", runId, artifact), `rendered artifact exists: ${artifact}`);
  }
}

/**
 * Runs a CLI command and records the result as a report step.
 *
 * @param {string[]} args - Command and arguments.
 * @param {Object} options - Step options.
 * @param {Object} [options.env] - Environment overrides.
 * @param {boolean} [options.expectFailure=false] - Whether the command should fail.
 * @param {string} [options.expectOutput] - Required output substring.
 * @param {string} options.label - Step label.
 * @param {string} options.scenario - Scenario label.
 * @returns {{stdout: string, stderr: string}} Captured output.
 */
function run(args, options) {
  return runProductCommand({ args, options, steps, workdir });
}

/**
 * Verifies an expected file exists in the isolated workdir.
 *
 * @param {string} relativePath - File path relative to the workdir.
 * @param {string} label - Report label.
 */
async function assertFile(relativePath, label) {
  await assertProductFile({ label, relativePath, steps, workdir });
}

/**
 * Records a product UAT assertion.
 *
 * @param {boolean} condition - Assertion condition.
 * @param {string} label - Report label.
 * @param {string} scenario - Scenario label.
 */
function assertCondition(condition, label, scenario) {
  assertProductCondition({ condition, label, scenario, steps });
}

/**
 * Writes JSON and Markdown UAT reports.
 *
 * @param {Object} summary - Summary fields.
 */
async function writeReports(summary) {
  await writeProductUatReports({ reportDir, startedAt, steps, summary });
}
