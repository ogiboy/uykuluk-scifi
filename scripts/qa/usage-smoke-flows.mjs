import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Validates fail-safe default project configuration after `producer init`.
 */
export async function assertDefaultConfigSafety({ workdir, assert }) {
  const defaults = JSON.parse(await readFile(path.join(workdir, "producer.config.json"), "utf8"));
  assert(defaults.providers.llm.mode === "mock", "default LLM mode is mock");
  assert(defaults.providers.youtube.enabled === false, "YouTube disabled by default");
  assert(
    defaults.providers.youtube.allowPrivateUpload === false,
    "private upload disabled by default",
  );
  assert(
    defaults.providers.youtube.allowPublicPublish === false,
    "public publish disabled by default",
  );
}

/**
 * Validates the local development environment passes all required diagnostic checks.
 * Confirms that the doctor command executes successfully and all critical checks (project config, LLM provider, production assets, publish defaults) have passed.
 */
export async function runDoctorSmoke({ run, pnpm, workdir, assertFile, assert }) {
  run([pnpm, "producer", "doctor"], {
    label: "doctor validates local setup",
    expectOutput: "Doctor passed",
  });
  await assertFile("diagnostics/doctor.json");
  await assertFile("diagnostics/doctor.md");
  const doctor = JSON.parse(
    await readFile(path.join(workdir, "diagnostics", "doctor.json"), "utf8"),
  );
  assert(doctor.passed === true, "doctor JSON passed=true");
  for (const checkName of [
    "project config",
    "LLM provider",
    "production assets",
    "publish defaults",
  ]) {
    assert(
      doctor.checks.some((check) => check.name === checkName && check.status === "pass"),
      `doctor passes ${checkName}`,
    );
  }
}

/**
 * Validates the script revision workflow by executing a revision command and confirming artifacts.
 * Reads a generated script, creates a revised version, runs the revision command, and asserts that exactly one revision directory exists with the required artifacts.
 */
export async function runScriptRevisionSmoke({ run, pnpm, workdir, runId, assertFile, assert }) {
  const generatedScript = await readFile(path.join(workdir, "runs", runId, "script.md"), "utf8");
  const revisedScriptPath = path.join(workdir, "revised-script.md");
  await writeFile(
    revisedScriptPath,
    `${generatedScript.trim()}\n\nOperator revision smoke evidence.\n`,
    "utf8",
  );
  const revisionResult = run(
    [
      pnpm,
      "producer",
      "revise",
      "script",
      "--run",
      runId,
      "--file",
      revisedScriptPath,
      "--reason",
      "Clean-copy revision smoke",
      "--editor",
      "usage-smoke",
      "--json",
    ],
    { label: "revise script JSON", expectOutput: '"artifact": "script.md"' },
  );
  const revision = JSON.parse(revisionResult.stdout);
  assert(revision.runId === runId, "script revision JSON includes run id");
  assert(revision.artifact === "script.md", "script revision JSON includes artifact");
  assert(revision.editor === "usage-smoke", "script revision JSON includes editor");
  assert(revision.nextState === "SCRIPT_GENERATED", "script revision JSON resets script state");
  const revisionIds = await readdir(path.join(workdir, "runs", runId, "revisions", "script"));
  assert(revisionIds.length === 1, "one script revision directory exists");
  assert(revisionIds[0] === revision.revisionId, "script revision directory matches JSON output");
  const revisionDir = path.join("runs", runId, "revisions", "script", revisionIds[0]);
  for (const artifact of ["before.md", "after.md", "revision.json"]) {
    await assertFile(path.join(revisionDir, artifact));
  }
}

export async function assertReviewEvidenceRecommendsWarningAcknowledgement({
  workdir,
  runId,
  assert,
}) {
  const reviewedEvidence = JSON.parse(
    await readFile(path.join(workdir, "runs", runId, "evidence_bundle.json"), "utf8"),
  );
  assert(
    reviewedEvidence.nextRecommendedCommand.includes("--acknowledge-warnings"),
    "review evidence recommends explicit warning acknowledgement",
  );
}

/**
 * Validates the operator summary JSON emitted by `producer status`.
 * Confirms the summary stays automation-friendly while `status --json` remains raw state output.
 */
export function runStatusSummarySmoke({ run, pnpm, runId, assert }) {
  const result = run([pnpm, "producer", "status", "--run", runId, "--summary-json"], {
    label: "status summary JSON",
    expectOutput: '"nextRecommendedCommand"',
  });
  const summary = JSON.parse(result.stdout);
  assert(summary.run?.runId === runId, "status summary JSON includes run id");
  assert(
    summary.run?.state === "READY_FOR_MANUAL_PRODUCTION",
    "status summary JSON includes current state",
  );
  assert(summary.evidenceStatus === "present", "status summary JSON has current evidence");
  assert(summary.readiness?.status === "passed", "status summary JSON has readiness status");
  assert(
    typeof summary.nextRecommendedCommand === "string" &&
      summary.nextRecommendedCommand.includes(runId),
    "status summary JSON materializes next recommended command",
  );
}

/**
 * Validates local manual analytics import/report commands from a clean copy.
 * Uses operator-provided CSV data only; no YouTube API or workflow mutation occurs.
 */
export async function runAnalyticsSmoke({ run, pnpm, workdir, runId, assertFile, assert }) {
  const csvPath = path.join(workdir, "performance.csv");
  await writeFile(
    csvPath,
    [
      "run_id,video_id,title,published_at,impressions,views,ctr,avg_view_duration_seconds,avg_percentage_viewed,subscribers_gained,likes,comments,notes",
      `${runId},yt_usage_001,"Usage Smoke",2026-06-28T00:00:00.000Z,1000,120,6%,90,40%,2,9,1,"Local import smoke"`,
    ].join("\n"),
    "utf8",
  );
  const importResult = run([pnpm, "producer", "analytics", "import", "--file", csvPath, "--json"], {
    label: "analytics import JSON",
    expectOutput: '"recordCount": 1',
  });
  const imported = JSON.parse(importResult.stdout);
  assert(imported.outputPath === "analytics/performance.json", "analytics import JSON path");
  assert(imported.reportPath === "analytics/performance_report.md", "analytics report JSON path");
  await assertFile("analytics/performance.json");
  await assertFile("analytics/performance_report.md");

  const reportResult = run([pnpm, "producer", "analytics", "report", "--json"], {
    label: "analytics report JSON",
    expectOutput: '"reportPath": "analytics/performance_report.md"',
  });
  const refreshed = JSON.parse(reportResult.stdout);
  assert(refreshed.report.includes("Manual Analytics Report"), "analytics report JSON has report");
  assert(refreshed.report.includes(runId), "analytics report links imported run id");
}
