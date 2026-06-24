import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

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
  run(
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
    ],
    { label: "revise script", expectOutput: "Script revision recorded" },
  );
  const revisionIds = await readdir(path.join(workdir, "runs", runId, "revisions", "script"));
  assert(revisionIds.length === 1, "one script revision directory exists");
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
