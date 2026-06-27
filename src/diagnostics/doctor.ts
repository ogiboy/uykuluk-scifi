import path from "node:path";
import { defaultConfig, loadConfig, projectConfigExists } from "../config/config.js";
import { ProducerConfig } from "../config/schema.js";
import { OllamaProvider } from "../providers/ollamaProvider.js";
import { checkAssets } from "../safeguards/assetGuard.js";
import { writeTextFile } from "../utils/fs.js";
import { writeJsonFile } from "../utils/json.js";
import { table } from "../utils/markdown.js";
import { nowIso } from "../utils/time.js";
import type { DoctorCheck, DoctorReport } from "./doctorSchema.js";
import { promptOverridesCheck } from "./promptOverrideDoctor.js";
import { renderToolchainCheck } from "./renderToolchainDoctor.js";
import { ttsProviderCheck } from "./ttsDoctor.js";
export type { DoctorCheck, DoctorReport } from "./doctorSchema.js";

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
 * Runs the project doctor and writes the resulting report to disk.
 *
 * The report includes configuration, provider, local media-toolchain, asset, and publish-default checks.
 *
 * @returns The completed diagnostic report.
 */
export async function runDoctor(): Promise<DoctorReport> {
  const startedAt = Date.now();
  const checks: DoctorCheck[] = [];
  let config: ProducerConfig | undefined;
  if (await projectConfigExists()) {
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
  } else {
    checks.push({
      name: "project config",
      status: "block",
      message: "producer.config.json is missing. Run pnpm producer init.",
    });
    config = defaultConfig;
  }

  const diagnosticChecks = [
    await promptOverridesCheck(config),
    await providerCheck(config),
    await ttsProviderCheck(config),
    renderToolchainCheck(),
    await assetCheck(config),
    publishDefaultsCheck(config),
  ];
  checks.push(...diagnosticChecks);

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
 * Formats a doctor report for console output.
 *
 * @param report - The diagnostic report to render
 * @returns A newline-separated console summary of the report
 */
export function formatDoctorConsole(report: DoctorReport): string {
  return [
    `Doctor ${report.passed ? "passed" : "blocked"}.`,
    ...report.checks.flatMap((check) => {
      const line = `[${check.status}] ${check.name}: ${check.message}`;
      return check.nextAction ? [line, `  Next action: ${check.nextAction}`] : [line];
    }),
  ].join("\n");
}

/**
 * Checks whether the configured LLM provider is ready for use.
 *
 * @param config - The project configuration to inspect.
 * @returns A diagnostic check describing the provider's status and message.
 */
async function providerCheck(config: ProducerConfig | undefined): Promise<DoctorCheck> {
  if (!config) {
    return {
      name: "LLM provider",
      status: "block",
      message: "Provider diagnostics require valid project config.",
      nextAction: "Fix producer.config.json, then rerun pnpm producer doctor.",
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
    nextAction: diagnostic.available
      ? undefined
      : "Start Ollama, install the configured model, or switch providers.llm.mode to mock before rerunning pnpm producer doctor.",
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
 * Checks whether YouTube publish defaults are locked down safely.
 *
 * @param config - Project configuration to inspect.
 * @returns A diagnostic check with `pass` status when YouTube upload and public publish are disabled and explicit approval is required, `block` otherwise.
 */
function publishDefaultsCheck(config: ProducerConfig | undefined): DoctorCheck {
  if (!config) {
    return {
      name: "publish defaults",
      status: "block",
      message: "Publish diagnostics require valid project config.",
      nextAction: "Fix producer.config.json, then rerun pnpm producer doctor.",
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
    nextAction: locked
      ? undefined
      : "Set providers.youtube.enabled, allowPrivateUpload, and allowPublicPublish to false unless a future upload/publish approval workflow is explicitly enabled.",
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
      ["Check", "Status", "Message", "Next action"],
      report.checks.map((check) => [
        check.name,
        check.status,
        markdownCell(check.message),
        markdownCell(check.nextAction ?? "None"),
      ]),
    ),
    "",
  ].join("\n");
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "/");
}
