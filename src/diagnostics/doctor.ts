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

export function doctorJsonPath(): string {
  return path.join(process.cwd(), "diagnostics", "doctor.json");
}

export function doctorMarkdownPath(): string {
  return path.join(process.cwd(), "diagnostics", "doctor.md");
}

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
