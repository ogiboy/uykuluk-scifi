import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import {
  assertProductCondition,
  assertProductFile,
  createFakeMediaTools,
  enableDeterministicTts,
  prepareWorkspace,
  runProductCommand,
  writeProductUatReports,
} from "./product-uat-helpers.mjs";
import {
  assertRenderedArtifacts,
  assertStaleEvidenceRecovery,
  assertTamperedRenderReviewCommandBlocks,
  createIdeaOnlyRun,
  createVoiceReadyRun,
  runManualAnalyticsSmoke,
} from "./product-uat-scenarios.mjs";

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

  const blockedRunId = await createIdeaOnlyRun({ pnpm, run, scenario: "blocked-order" });
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

  const renderedRunId = await createVoiceReadyRun({
    pnpm,
    run,
    scenario: "happy-path",
    workdir,
  });
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
  run([pnpm, "producer", "evidence", "--run", renderedRunId], {
    label: "rendered evidence is current",
    scenario: "happy path",
  });
  run([pnpm, "producer", "readiness", "--run", renderedRunId], {
    expectOutput: "Readiness passed",
    label: "rendered readiness is current",
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
  await assertRenderedArtifacts({ assertFile, runId: renderedRunId });
  await runManualAnalyticsSmoke({
    assertCondition,
    assertFile,
    pnpm,
    run,
    runId: renderedRunId,
    workdir,
  });
  run([pnpm, "exec", "tsx", "scripts/qa/product-uat-studio-readonly.ts", renderedRunId], {
    env: { UYKULUK_SCIFI_ROOT: workdir },
    expectOutput: "Studio read-only UAT passed.",
    label: "studio read-only services expose reviewable run",
    scenario: "studio read-only",
  });
  await assertStaleEvidenceRecovery({ pnpm, run, runId: renderedRunId, workdir });
  await assertTamperedRenderReviewCommandBlocks({ pnpm, run, runId: renderedRunId, workdir });

  const tamperedRunId = await createVoiceReadyRun({
    pnpm,
    run,
    scenario: "tampered-render-input",
    workdir,
  });
  run([pnpm, "producer", "approve", "render", "--run", tamperedRunId], {
    expectOutput: "Render approval recorded",
    label: "render approval recorded before input tamper",
    scenario: "tamper",
  });
  await appendToProductFile({
    content: "tampered",
    relativePath: path.join("runs", tamperedRunId, "production", "audio", "voiceover.wav"),
  });
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
 * Appends text to a file under the isolated workdir.
 *
 * @param {Object} input - Append input.
 * @param {string} input.content - Text to append.
 * @param {string} input.relativePath - File path relative to the isolated workdir.
 */
async function appendToProductFile({ content, relativePath }) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(path.join(workdir, relativePath), content, "utf8");
}

/**
 * Writes JSON and Markdown UAT reports.
 *
 * @param {Object} summary - Summary fields.
 */
async function writeReports(summary) {
  await writeProductUatReports({ reportDir, startedAt, steps, summary });
}
