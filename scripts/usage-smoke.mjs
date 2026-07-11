import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertDefaultConfigSafety,
  assertReviewEvidenceRecommendsWarningAcknowledgement,
  runAnalyticsSmoke,
  runDoctorSmoke,
  runLocalModelEvalSmoke,
  runScriptRevisionSmoke,
  runStatusSummarySmoke,
} from "./qa/usage-smoke-flows.mjs";
import { enableDeterministicTts, runLocalMediaSmoke } from "./qa/usage-smoke-media.mjs";

const repoRoot = process.cwd();
const pnpm = process.env.PNPM_EXECUTABLE ?? "pnpm";
const startedAt = new Date();
const stamp = startedAt.toISOString().replaceAll(/[-:]/g, "").split(".")[0].replaceAll("T", "-");
const reportDir = path.join(repoRoot, ".ai", "qa", "artifacts", `usage-smoke-${stamp}`);
const tempRoot = await mkdtemp(path.join(tmpdir(), "uykulukscifi-usage-"));
const workdir = path.join(tempRoot, "project");
const steps = [];
const requiredArtifacts = [
  "ideas.json",
  "ideas.md",
  "script.md",
  "script.meta.json",
  "reviews/script_review.json",
  "reviews/script_review.md",
  "production/voiceover.txt",
  "production/subtitles.srt",
  "production/scenes.json",
  "production/youtube_metadata.json",
  "production/production_package.md",
  "production/production_package.meta.json",
  "costs/estimate.json",
  "costs/estimate.md",
  "costs/ledger.jsonl",
  "evidence_bundle.md",
  "evidence_bundle.json",
  "diagnostics/readiness.json",
  "diagnostics/readiness.md",
  "ledger.jsonl",
];

await mkdir(reportDir, { recursive: true });

try {
  await cp(repoRoot, workdir, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(repoRoot, source);
      if (!relative) return true;
      return !(
        relative === ".git" ||
        relative.startsWith(`.git${path.sep}`) ||
        relative === "node_modules" ||
        relative.startsWith(`node_modules${path.sep}`) ||
        relative === "runs" ||
        relative.startsWith(`runs${path.sep}`) ||
        relative === "producer.config.json" ||
        relative.startsWith(`.ai${path.sep}qa${path.sep}artifacts`)
      );
    },
  });

  run([pnpm, "install"], { label: "clean install" });
  run([pnpm, "producer", "init"], { label: "init creates config and dirs" });
  await assertFile("producer.config.json");
  await runDoctorSmoke({ run, pnpm, workdir, assertFile, assert });
  await runLocalModelEvalSmoke({ run, pnpm, workdir, assertFile, assert });
  await assertDefaultConfigSafety({ workdir, assert });

  const blockedIdeas = run([pnpm, "producer", "ideas"], {
    label: "negative setup: ideas for blocked run",
  });
  const blockedRunId = extractRunId(blockedIdeas.stdout);
  run([pnpm, "producer", "script", "--run", blockedRunId], {
    label: "script blocked before idea approval",
    expectFailure: true,
    expectOutput: "requires state IDEA_APPROVED",
  });
  run([pnpm, "producer", "package", "--run", blockedRunId], {
    label: "package blocked before script approval",
    expectFailure: true,
    expectOutput: "requires state SCRIPT_APPROVED",
  });

  const ideas = run([pnpm, "producer", "ideas"], { label: "ideas" });
  const runId = extractRunId(ideas.stdout);
  const ideasJson = JSON.parse(
    await readFile(path.join(workdir, "runs", runId, "ideas.json"), "utf8"),
  );
  const ideaId = ideasJson.ideas[0].id;

  run([pnpm, "producer", "approve", "idea", "--run", runId, "--idea", ideaId], {
    label: "approve idea",
  });
  run([pnpm, "producer", "script", "--run", runId], { label: "script" });
  await runScriptRevisionSmoke({ run, pnpm, workdir, runId, assertFile, assert });
  run([pnpm, "producer", "review", "script", "--run", runId], { label: "review script" });
  run([pnpm, "producer", "evidence", "--run", runId], {
    label: "review evidence recommends warning acknowledgement",
  });
  await assertReviewEvidenceRecommendsWarningAcknowledgement({ workdir, runId, assert });
  run([pnpm, "producer", "approve", "script", "--run", runId], {
    label: "approve script blocked before warning acknowledgement",
    expectFailure: true,
    expectOutput: "acknowledge-warnings",
  });
  run([pnpm, "producer", "approve", "script", "--run", runId, "--acknowledge-warnings"], {
    label: "approve script with warning acknowledgement",
  });
  run([pnpm, "producer", "package", "--run", runId], { label: "package" });
  run([pnpm, "producer", "render-plan", "--run", runId], { label: "render plan" });
  run([pnpm, "producer", "voice", "--run", runId], {
    label: "voice disabled",
    expectFailure: true,
    expectOutput: "Voice/TTS is disabled",
  });
  await enableDeterministicTts({ workdir });
  run([pnpm, "producer", "estimate", "--run", runId], { label: "estimate" });
  run([pnpm, "producer", "approve", "cost", "--run", runId], {
    label: "zero-cost quote rejects unnecessary cost approval",
    expectFailure: true,
    expectOutput: "does not require explicit approval",
  });
  run([pnpm, "producer", "evidence", "--run", runId], { label: "evidence" });
  run([pnpm, "producer", "readiness", "--run", runId], {
    label: "readiness",
    expectOutput: "Readiness passed",
  });
  run([pnpm, "producer", "status", "--run", runId], {
    label: "status",
    expectOutput: "READY_FOR_MANUAL_PRODUCTION",
  });
  runStatusSummarySmoke({ run, pnpm, runId, assert });
  run([pnpm, "producer", "status", "--latest"], { label: "status latest", expectOutput: runId });
  run([pnpm, "producer", "list-runs"], { label: "list-runs", expectOutput: runId });

  for (const artifact of requiredArtifacts) {
    await assertFile(path.join("runs", runId, artifact));
  }

  const state = JSON.parse(await readFile(path.join(workdir, "runs", runId, "state.json"), "utf8"));
  const evidence = JSON.parse(
    await readFile(path.join(workdir, "runs", runId, "evidence_bundle.json"), "utf8"),
  );
  const readiness = JSON.parse(
    await readFile(path.join(workdir, "runs", runId, "diagnostics", "readiness.json"), "utf8"),
  );
  assert(
    state.state === "READY_FOR_MANUAL_PRODUCTION",
    "final state is READY_FOR_MANUAL_PRODUCTION",
  );
  assert(evidence.currentState === state.state, "evidence currentState matches state.json");
  assert(readiness.currentState === state.state, "readiness currentState matches state.json");
  for (const key of [
    "approvals",
    "costs",
    "costReservations",
    "warnings",
    "generatedArtifacts",
    "promptProvenance",
    "revisions",
    "blockedActions",
    "nextRecommendedCommand",
  ]) {
    assert(Object.hasOwn(evidence, key), `evidence includes ${key}`);
  }
  assert(
    evidence.promptProvenance.length === 3,
    "evidence includes three prompt provenance records",
  );
  assert(
    evidence.promptProvenance.every(
      (prompt) =>
        typeof prompt.key === "string" &&
        typeof prompt.artifact === "string" &&
        typeof prompt.source === "string" &&
        prompt.source.startsWith("prompts/defaults/") &&
        /^[a-f0-9]{64}$/.test(prompt.hash),
    ),
    "prompt provenance records contain runtime default sources and stable SHA-256 hashes",
  );
  assert(evidence.revisions.length === 1, "evidence includes one script revision");
  assert(readiness.passed === true, "readiness JSON passed=true");
  assert(
    readiness.checks.some(
      (check) => check.name === "brand assets present" && check.status === "pass",
    ),
    "readiness passes with committed brand assets",
  );
  assert(
    readiness.checks.some(
      (check) =>
        check.name === "public upload disabled without explicit config" && check.status === "pass",
    ),
    "readiness confirms public publish disabled",
  );

  const ledgerLines = (await readFile(path.join(workdir, "runs", runId, "ledger.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  for (const eventType of [
    "RUN_CREATED",
    "STATE_CHANGED",
    "ARTIFACT_WRITTEN",
    "ARTIFACT_REVISED",
    "APPROVAL_RECORDED",
    "COST_ESTIMATED",
    "GUARD_PASSED",
  ]) {
    assert(
      ledgerLines.some((event) => event.type === eventType),
      `ledger contains ${eventType}`,
    );
  }

  await runLocalMediaSmoke({ run, pnpm, workdir, runId, assertFile, assert });
  await runAnalyticsSmoke({ run, pnpm, workdir, runId, assertFile, assert });

  await writeReports({ runId, passed: true });
  console.log(
    `Usage smoke passed. Report: ${path.relative(repoRoot, path.join(reportDir, "qa-report.md"))}`,
  );
} catch (error) {
  await writeReports({
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
/**
 * Runs a CLI command and records the result as a QA step.
 * @param {string[]} args - The command and arguments to execute.
 * @param {Object} [options]
 * @param {string} [options.label] - The step label to record.
 * @param {boolean} [options.expectFailure=false] - Whether a non-zero exit status is expected.
 * @param {string} [options.expectOutput] - A substring that must appear in the combined output.
 * @param {Object} [options.env] - Environment variables to merge into the spawned process environment.
 * @return {{stdout: string, stderr: string}} The captured standard output and standard error.
 */
function run(args, options = {}) {
  const { label = args.join(" "), expectFailure = false, expectOutput, env } = options;
  const result = spawnSync(args[0], args.slice(1), {
    cwd: workdir,
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const passedExit = expectFailure ? result.status !== 0 : result.status === 0;
  const passedOutput = expectOutput ? output.includes(expectOutput) : true;
  const passed = passedExit && passedOutput;
  steps.push({
    label,
    command: args.join(" "),
    status: result.status,
    passed,
    expectFailure,
    expectOutput,
    output: output.trim(),
  });
  if (!passed) {
    throw new Error(`QA step failed: ${label}\n${output}`);
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function extractRunId(output) {
  const match = /Run created:\s+(run_[^\s]+)/.exec(output);
  if (!match) {
    throw new Error(`Could not extract run id from output:\n${output}`);
  }
  return match[1];
}

async function assertFile(relativePath) {
  const target = path.join(workdir, relativePath);
  if (!existsSync(target)) {
    throw new Error(`Missing expected file: ${relativePath}`);
  }
  const info = await stat(target);
  assert(info.isFile(), `file exists: ${relativePath}`);
}

function assert(condition, message) {
  steps.push({
    label: message,
    command: "assert",
    status: condition ? 0 : 1,
    passed: Boolean(condition),
    output: "",
  });
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function writeReports(summary) {
  const finishedAt = new Date();
  const json = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    tempRoot,
    ...summary,
    steps,
  };
  await writeFile(
    path.join(reportDir, "usage-smoke-summary.json"),
    `${JSON.stringify(json, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(reportDir, "qa-report.md"), renderMarkdown(json), "utf8");
}

function renderMarkdown(report) {
  return [
    "# Usage Smoke QA Report",
    "",
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt}`,
    `Passed: ${report.passed}`,
    report.runId ? `Run id: ${report.runId}` : undefined,
    report.error ? `Error: ${report.error}` : undefined,
    "",
    "## Steps",
    "",
    "| Step | Result | Command |",
    "| --- | --- | --- |",
    ...report.steps.map(
      (step) =>
        `| ${escapeCell(step.label)} | ${step.passed ? "PASS" : "FAIL"} | ${escapeCell(step.command)} |`,
    ),
    "",
  ]
    .filter(Boolean)
    .join("\n");
}
function escapeCell(value) {
  return String(value).replaceAll("|", "/").replaceAll("\n", "<br>");
}
