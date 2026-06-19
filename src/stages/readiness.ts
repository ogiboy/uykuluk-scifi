import { loadConfig, projectConfigExists } from "../config/config";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts";
import { loadRun, setRunState } from "../core/runStore";
import { canTransition } from "../core/transitions";
import { checkAssets } from "../safeguards/assetGuard";
import { pathExists } from "../utils/fs";
import { readJsonFile } from "../utils/json";
import { bulletList, table } from "../utils/markdown";
import { generateEvidenceBundle } from "./evidence";

type ReadinessCheck = {
  name: string;
  status: "pass" | "warn" | "block";
  message: string;
};

/**
 * Validates a run's readiness for manual production.
 *
 * Performs 11 readiness checks covering configuration, assets, artifacts, approvals, and budget. Writes diagnostic reports to the run directory. If all checks pass and conditions are met, transitions the run state to `READY_FOR_MANUAL_PRODUCTION` and generates an evidence bundle.
 *
 * @param runId - The ID of the run to validate
 * @returns `passed` is `true` if no checks have a block status; `checks` is the array of all readiness checks performed
 */
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
    await budgetEstimateCheck(run.runId),
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
    run = await setRunState(run, "READY_FOR_MANUAL_PRODUCTION", "readiness");
    await writeRunJson(run, "readiness", "diagnostics/readiness.json", {
      runId: run.runId,
      currentState: run.state,
      passed,
      checks,
    });
    await generateEvidenceBundle(run.runId);
  }
  return { passed, checks };
}

/**
 * Checks whether an artifact file exists within a run.
 *
 * @param name - The name of the readiness check
 * @param relativePath - The artifact path relative to the run directory
 * @returns A readiness check that passes if the artifact exists, blocks if it is missing
 */
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

/**
 * Validates the cost estimate and determines if the next step is allowed.
 *
 * Reads `costs/estimate.json` and checks if the estimate permits proceeding. Blocks readiness if the file is missing, cannot be read, or indicates the next step is not allowed.
 *
 * @param runId - The run identifier
 * @returns A readiness check that passes if the cost estimate allows proceeding, blocks otherwise
 */
async function budgetEstimateCheck(runId: string): Promise<ReadinessCheck> {
  const relativePath = "costs/estimate.json";
  const target = artifactPath(runId, relativePath);
  if (!(await pathExists(target))) {
    return {
      name: "budget not exceeded",
      status: "block",
      message: `${relativePath} is missing.`,
    };
  }
  try {
    const estimate = await readJsonFile<{
      nextStepAllowed?: boolean;
      blockedReasons?: unknown;
    }>(target);
    const blockedReasons = Array.isArray(estimate.blockedReasons)
      ? estimate.blockedReasons.filter((reason): reason is string => typeof reason === "string")
      : [];
    if (estimate.nextStepAllowed !== true || blockedReasons.length > 0) {
      return {
        name: "budget not exceeded",
        status: "block",
        message:
          blockedReasons.length > 0
            ? blockedReasons.join(" ")
            : "Cost estimate does not allow the next step.",
      };
    }
    return {
      name: "budget not exceeded",
      status: "pass",
      message: "Cost estimate allows the next step.",
    };
  } catch (error) {
    return {
      name: "budget not exceeded",
      status: "block",
      message: `Cost estimate could not be read: ${(error as Error).message}`,
    };
  }
}

/**
 * Creates a readiness check based on a condition.
 *
 * @returns A readiness check with status `pass` if `ok` is `true`, `block` if `ok` is `false`, using the corresponding message.
 */
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
