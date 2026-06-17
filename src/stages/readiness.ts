import { loadConfig, projectConfigExists } from "../config/config";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts";
import { loadRun, setRunState } from "../core/runStore";
import { canTransition } from "../core/transitions";
import { checkAssets } from "../safeguards/assetGuard";
import { pathExists } from "../utils/fs";
import { bulletList, table } from "../utils/markdown";
import { generateEvidenceBundle } from "./evidence";

type ReadinessCheck = {
  name: string;
  status: "pass" | "warn" | "block";
  message: string;
};

export async function runReadiness(
  runId: string,
): Promise<{ passed: boolean; checks: ReadinessCheck[] }> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  const assets = await checkAssets(config);
  const checks: ReadinessCheck[] = [
    await fileCheck(
      "project config exists",
      await projectConfigExists(),
      "producer.config.json exists.",
      "Run pnpm producer init.",
    ),
    {
      name: "provider configured",
      status:
        config.providers.llm.mode === "mock" || config.providers.llm.mode === "ollama"
          ? "pass"
          : "block",
      message: `LLM provider mode: ${config.providers.llm.mode}.`,
    },
    {
      name: "brand assets present",
      status: assets.passed ? "pass" : "warn",
      message: assets.passed ? "Brand assets present." : assets.warnings.join(" "),
    },
    await artifactCheck(run.runId, "script generated", "script.md"),
    await artifactCheck(run.runId, "script reviewed", "reviews/script_review.json"),
    {
      name: "script approved",
      status: run.approvals.some(
        (approval) => approval.runId === run.runId && approval.target === "script",
      )
        ? "pass"
        : "block",
      message: "Script approval must be explicit in run state.",
    },
    await artifactCheck(
      run.runId,
      "production package generated",
      "production/production_package.md",
    ),
    await artifactCheck(run.runId, "budget not exceeded", "costs/estimate.json"),
    {
      name: "no blocked publish action",
      status: "pass",
      message: "No upload or publish action has been executed.",
    },
    {
      name: "public upload disabled without explicit config",
      status: config.providers.youtube.allowPublicPublish ? "block" : "pass",
      message: config.providers.youtube.allowPublicPublish
        ? "Public publish is enabled; verify explicit approval controls before continuing."
        : "Public/scheduled publish remains disabled by default.",
    },
    await artifactCheck(run.runId, "evidence bundle available", "evidence_bundle.json"),
  ];
  const passed = checks.every((check) => check.status !== "block");
  run = await writeRunJson(run, "readiness", "diagnostics/readiness.json", {
    runId: run.runId,
    currentState: run.state,
    passed,
    checks,
  });
  run = await writeRunText(
    run,
    "readiness",
    "diagnostics/readiness.md",
    [
      "# Readiness",
      "",
      `Run: ${run.runId}`,
      `Passed: ${passed}`,
      "",
      table(
        ["Check", "Status", "Message"],
        checks.map((check) => [check.name, check.status, check.message.replace(/\|/g, "/")]),
      ),
      "",
      "## Warnings",
      "",
      bulletList(
        checks
          .filter((check) => check.status === "warn")
          .map((check) => `${check.name}: ${check.message}`),
      ),
    ].join("\n"),
  );
  if (
    passed &&
    run.state === "COST_ESTIMATED" &&
    canTransition(run.state, "READY_FOR_MANUAL_PRODUCTION")
  ) {
    await setRunState(run, "READY_FOR_MANUAL_PRODUCTION", "readiness");
    await generateEvidenceBundle(run.runId);
  }
  return { passed, checks };
}

async function artifactCheck(
  runId: string,
  name: string,
  relativePath: string,
): Promise<ReadinessCheck> {
  return fileCheck(
    name,
    await pathExists(artifactPath(runId, relativePath)),
    `${relativePath} exists.`,
    `${relativePath} is missing.`,
  );
}

async function fileCheck(
  name: string,
  ok: boolean,
  passMessage: string,
  failMessage: string,
): Promise<ReadinessCheck> {
  return {
    name,
    status: ok ? "pass" : "block",
    message: ok ? passMessage : failMessage,
  };
}
