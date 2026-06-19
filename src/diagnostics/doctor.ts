import path from "node:path";
import { defaultConfig, loadConfig, projectConfigExists } from "../config/config";
import { ProducerConfig } from "../config/schema";
import { OllamaProvider } from "../providers/ollamaProvider";
import { checkAssets } from "../safeguards/assetGuard";
import { writeTextFile } from "../utils/fs";
import { writeJsonFile } from "../utils/json";
import { table } from "../utils/markdown";
import { nowIso } from "../utils/time";

export type DoctorCheck = {
  name: string;
  status: "pass" | "warn" | "block";
  message: string;
};

export type DoctorReport = {
  createdAt: string;
  durationMs: number;
  passed: boolean;
  checks: DoctorCheck[];
};

/**
 * Gets the absolute path to the doctor JSON diagnostics file.
 *
 * @returns The absolute path to `diagnostics/doctor.json` under the current working directory.
 */
export function doctorJsonPath(): string {
  return path.join(process.cwd(), "diagnostics", "doctor.json");
}

/**
 * Resolves the absolute path to the diagnostic Markdown report.
 *
 * @returns The absolute path to the diagnostic Markdown report.
 */
export function doctorMarkdownPath(): string {
  return path.join(process.cwd(), "diagnostics", "doctor.md");
}

/**
 * Generates and writes a diagnostic report of the project's health.
 *
 * Performs checks on project configuration validity, provider availability, production assets, and publish settings.
 * Writes the report in JSON and Markdown formats to the diagnostics directory.
 *
 * @returns The diagnostic report with all checks and overall pass/fail status.
 */
export async function runDoctor(): Promise<DoctorReport> {
  const startedAt = Date.now();
  const checks: DoctorCheck[] = [];
  let config: ProducerConfig | undefined;
  if (!(await projectConfigExists())) {
    checks.push({
      name: "project config",
      status: "block",
      message: "producer.config.json is missing. Run pnpm producer init.",
    });
    config = defaultConfig;
  } else {
    try {
      config = await loadConfig();
      checks.push({
        name: "project config",
        status: "pass",
        message: "producer.config.json is valid.",
      });
    } catch (error) {
      checks.push({
        name: "project config",
        status: "block",
        message: `producer.config.json is invalid: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  checks.push(await providerCheck(config));
  checks.push(await assetCheck(config));
  checks.push(publishDefaultsCheck(config));

  const report: DoctorReport = {
    createdAt: nowIso(),
    durationMs: Date.now() - startedAt,
    passed: checks.every((check) => check.status !== "block"),
    checks,
  };
  await writeJsonFile(doctorJsonPath(), report);
  await writeTextFile(doctorMarkdownPath(), renderDoctorMarkdown(report));
  return report;
}

/**
 * Diagnoses the availability and readiness of the LLM provider.
 *
 * @returns A diagnostic check with the provider's current status and configuration message.
 */
async function providerCheck(config: ProducerConfig | undefined): Promise<DoctorCheck> {
  if (!config) {
    return {
      name: "LLM provider",
      status: "block",
      message: "Provider diagnostics require valid project config.",
    };
  }
  if (config.providers.llm.mode === "mock") {
    return {
      name: "LLM provider",
      status: "pass",
      message: `Deterministic mock provider is ready (${config.providers.llm.model}).`,
    };
  }
  const diagnostic = await new OllamaProvider(
    config.providers.llm.ollamaBaseUrl,
    config.providers.llm.model,
  ).diagnose();
  return {
    name: "LLM provider",
    status: diagnostic.available ? "pass" : "block",
    message: diagnostic.message,
  };
}

/**
 * Checks whether required production assets are present.
 *
 * @returns A DoctorCheck with status "pass" if all required assets are present, "warn" if any are missing, or "block" if the project configuration is unavailable.
 */
async function assetCheck(config: ProducerConfig | undefined): Promise<DoctorCheck> {
  if (!config) {
    return {
      name: "production assets",
      status: "block",
      message: "Asset diagnostics require valid project config.",
    };
  }
  const assets = await checkAssets(config);
  return {
    name: "production assets",
    status: assets.passed ? "pass" : "warn",
    message: assets.passed ? "Required production assets are present." : assets.warnings.join(" "),
  };
}

/**
 * Determines if YouTube publish defaults are safely locked.
 *
 * @returns A diagnostic check with `pass` status if YouTube upload and public publish are disabled with explicit approval required, `block` status otherwise.
 */
function publishDefaultsCheck(config: ProducerConfig | undefined): DoctorCheck {
  if (!config) {
    return {
      name: "publish defaults",
      status: "block",
      message: "Publish diagnostics require valid project config.",
    };
  }
  const youtube = config.providers.youtube;
  const locked =
    !youtube.enabled &&
    !youtube.allowPrivateUpload &&
    !youtube.allowPublicPublish &&
    config.safeguards.neverPublicPublishWithoutExplicitApproval;
  return {
    name: "publish defaults",
    status: locked ? "pass" : "block",
    message: locked
      ? "YouTube upload and public/scheduled publish remain disabled."
      : "Risky YouTube configuration detected; keep upload and public publish disabled.",
  };
}

/**
 * Renders a diagnostic report as Markdown.
 *
 * @returns A Markdown string containing the report metadata and checks in table format.
 */
function renderDoctorMarkdown(report: DoctorReport): string {
  return [
    "# Producer Doctor",
    "",
    `Created: ${report.createdAt}`,
    `Duration: ${report.durationMs} ms`,
    `Passed: ${report.passed}`,
    "",
    table(
      ["Check", "Status", "Message"],
      report.checks.map((check) => [check.name, check.status, check.message.replace(/\|/g, "/")]),
    ),
    "",
  ].join("\n");
}
