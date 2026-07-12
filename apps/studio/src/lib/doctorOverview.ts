import { readFile } from "node:fs/promises";
import path from "node:path";
import { ZodError } from "zod";
import { doctorReportSchema, type DoctorCheck } from "../../../../src/diagnostics/doctorSchema";
import {
  ArtifactJsonParseError,
  parseArtifactJson,
  readOptionalText,
} from "./artifacts/localArtifactReads";
import { projectRoot } from "./projectRoot";

const DOCTOR_JSON_PATH = "diagnostics/doctor.json";
const DOCTOR_MARKDOWN_PATH = "diagnostics/doctor.md";
const REPORT_PREVIEW_LIMIT = 3_000;

export type StudioDoctorStatus = "blocked" | "invalid" | "missing" | "passing" | "warning";

export type StudioDoctorOverview = {
  blockCount: number;
  checkCount: number;
  createdAt: string | null;
  durationMs: number | null;
  error: string | null;
  jsonPath: string;
  markdownPath: string;
  nextAction: string;
  passCount: number;
  reportPreview: string | null;
  reportPreviewTruncated: boolean;
  status: StudioDoctorStatus;
  warnCount: number;
  checks: StudioDoctorCheckSummary[];
};

export type StudioDoctorCheckSummary = {
  message: string;
  name: string;
  nextAction: string | null;
  status: DoctorCheck["status"];
};

/**
 * Loads the latest persisted producer doctor report for read-only Studio display.
 *
 * @returns A Studio-safe overview of `diagnostics/doctor.json` and `diagnostics/doctor.md`.
 */
export async function getStudioDoctorOverview(): Promise<StudioDoctorOverview> {
  const root = projectRoot();
  const jsonTarget = path.join(root, ...DOCTOR_JSON_PATH.split("/"));
  const markdownTarget = path.join(root, ...DOCTOR_MARKDOWN_PATH.split("/"));
  const report = await readOptionalText(markdownTarget, REPORT_PREVIEW_LIMIT);

  try {
    const rawReport = await readFile(jsonTarget, "utf8");
    const parsedReport = doctorReportSchema.parse(parseArtifactJson(rawReport, DOCTOR_JSON_PATH));
    const checks = parsedReport.checks.map(summarizeCheck);
    const blockCount = countChecks(parsedReport.checks, "block");
    const warnCount = countChecks(parsedReport.checks, "warn");

    return {
      blockCount,
      checkCount: parsedReport.checks.length,
      checks,
      createdAt: parsedReport.createdAt,
      durationMs: parsedReport.durationMs,
      error: null,
      jsonPath: DOCTOR_JSON_PATH,
      markdownPath: DOCTOR_MARKDOWN_PATH,
      nextAction: nextDoctorAction(parsedReport.checks),
      passCount: countChecks(parsedReport.checks, "pass"),
      reportPreview: report.text,
      reportPreviewTruncated: report.truncated,
      status: doctorStatus(parsedReport.passed, blockCount, warnCount),
      warnCount,
    };
  } catch (error) {
    return missingOrInvalidDoctorOverview(error, report);
  }
}

/**
 * Builds a safe missing/invalid overview when the doctor JSON cannot be trusted.
 *
 * @param error - The read, parse, or validation error.
 * @param report - Optional Markdown report preview metadata.
 * @returns A fallback doctor overview with no trusted checks.
 */
function missingOrInvalidDoctorOverview(
  error: unknown,
  report: { text: string | null; truncated: boolean },
): StudioDoctorOverview {
  const missingReport = (error as NodeJS.ErrnoException).code === "ENOENT";
  return {
    blockCount: 0,
    checkCount: 0,
    checks: [],
    createdAt: null,
    durationMs: null,
    error: missingReport ? null : invalidDoctorMessage(error),
    jsonPath: DOCTOR_JSON_PATH,
    markdownPath: DOCTOR_MARKDOWN_PATH,
    nextAction: "pnpm producer doctor",
    passCount: 0,
    reportPreview: report.text,
    reportPreviewTruncated: report.truncated,
    status: missingReport ? "missing" : "invalid",
    warnCount: 0,
  };
}

/**
 * Summarizes a persisted doctor check for the Studio operator surface.
 *
 * @param check - The validated doctor check.
 * @returns The read-only check summary.
 */
function summarizeCheck(check: DoctorCheck): StudioDoctorCheckSummary {
  return {
    message: check.message,
    name: check.name,
    nextAction: check.nextAction ?? null,
    status: check.status,
  };
}

/**
 * Counts checks with a matching status.
 *
 * @param checks - The doctor checks to count.
 * @param status - The status to match.
 * @returns Number of matching checks.
 */
function countChecks(checks: readonly DoctorCheck[], status: DoctorCheck["status"]): number {
  return checks.filter((check) => check.status === status).length;
}

/**
 * Chooses the next safe operator action from the doctor report.
 *
 * @param checks - The validated doctor checks.
 * @returns A copy-pasteable operator command or remediation note.
 */
function nextDoctorAction(checks: readonly DoctorCheck[]): string {
  return (
    checks.find((check) => check.status === "block" && check.nextAction)?.nextAction ??
    checks.find((check) => check.status === "warn" && check.nextAction)?.nextAction ??
    "pnpm producer doctor"
  );
}

/**
 * Maps validated doctor report state into a compact Studio status.
 *
 * @param passed - Whether the doctor report passed.
 * @param blockCount - Number of blocking checks.
 * @param warnCount - Number of warning checks.
 * @returns The Studio status label.
 */
function doctorStatus(passed: boolean, blockCount: number, warnCount: number): StudioDoctorStatus {
  if (!passed || blockCount > 0) {
    return "blocked";
  }
  return warnCount > 0 ? "warning" : "passing";
}

/**
 * Creates an operator-facing invalid doctor report message.
 *
 * @param error - The invalid report error.
 * @returns A safe remediation-oriented error string.
 */
function invalidDoctorMessage(error: unknown): string {
  if (error instanceof ArtifactJsonParseError) {
    return "diagnostics/doctor.json contains malformed JSON or a truncated write.";
  }
  if (error instanceof ZodError) {
    return "diagnostics/doctor.json is missing required fields.";
  }
  return "diagnostics/doctor.json could not be read.";
}
