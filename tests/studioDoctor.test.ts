import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getStudioDoctorOverview } from "../apps/studio/src/lib/doctorOverview";
import type { DoctorReport } from "../src/diagnostics/doctorSchema";
import { useTempProject } from "./helpers";

const passingDoctorReport = {
  checks: [
    {
      message: "producer.config.json is valid.",
      name: "project config",
      status: "pass",
    },
    {
      message: "YouTube upload and public/scheduled publish remain disabled.",
      name: "publish defaults",
      status: "pass",
    },
  ],
  createdAt: "2026-06-27T10:00:00.000Z",
  durationMs: 42,
  passed: true,
} satisfies DoctorReport;

describe("Studio producer doctor overview", () => {
  useTempProject();

  it("returns a safe missing state before doctor diagnostics are generated", async () => {
    const overview = await getStudioDoctorOverview();

    expect(overview).toMatchObject({
      blockCount: 0,
      checkCount: 0,
      error: null,
      nextAction: "pnpm producer doctor",
      reportPreview: null,
      status: "missing",
      warnCount: 0,
    });
  });

  it("summarizes local producer doctor artifacts without mutation", async () => {
    await mkdir("diagnostics", { recursive: true });
    await writeFile("diagnostics/doctor.json", JSON.stringify(passingDoctorReport), "utf8");
    await writeFile("diagnostics/doctor.md", "# Producer Doctor\n\nPassed: true\n", "utf8");

    const overview = await getStudioDoctorOverview();

    expect(overview).toMatchObject({
      blockCount: 0,
      checkCount: 2,
      createdAt: "2026-06-27T10:00:00.000Z",
      durationMs: 42,
      error: null,
      jsonPath: "diagnostics/doctor.json",
      markdownPath: "diagnostics/doctor.md",
      nextAction: "pnpm producer doctor",
      passCount: 2,
      reportPreview: expect.stringContaining("Producer Doctor"),
      reportPreviewTruncated: false,
      status: "passing",
      warnCount: 0,
    });
    expect(overview.checks).toEqual([
      {
        message: "producer.config.json is valid.",
        name: "project config",
        nextAction: null,
        status: "pass",
      },
      {
        message: "YouTube upload and public/scheduled publish remain disabled.",
        name: "publish defaults",
        nextAction: null,
        status: "pass",
      },
    ]);
  });

  it("surfaces the first blocking doctor remediation as the next safe action", async () => {
    await mkdir("diagnostics", { recursive: true });
    await writeFile(
      "diagnostics/doctor.json",
      JSON.stringify({
        ...passingDoctorReport,
        checks: [
          {
            message: "Ollama is unavailable.",
            name: "LLM provider",
            nextAction:
              "Start Ollama, install the configured model, or switch providers.llm.mode to mock before rerunning pnpm producer doctor.",
            status: "block",
          },
          ...passingDoctorReport.checks,
        ],
        passed: false,
      }),
      "utf8",
    );

    const overview = await getStudioDoctorOverview();

    expect(overview).toMatchObject({
      blockCount: 1,
      nextAction:
        "Start Ollama, install the configured model, or switch providers.llm.mode to mock before rerunning pnpm producer doctor.",
      status: "blocked",
    });
  });

  it("distinguishes malformed doctor JSON from schema validation failures", async () => {
    await mkdir("diagnostics", { recursive: true });
    await writeFile("diagnostics/doctor.json", "{", "utf8");

    await expect(getStudioDoctorOverview()).resolves.toMatchObject({
      error: "diagnostics/doctor.json contains malformed JSON or a truncated write.",
      status: "invalid",
    });

    await writeFile("diagnostics/doctor.json", JSON.stringify({ checks: [] }), "utf8");

    await expect(getStudioDoctorOverview()).resolves.toMatchObject({
      error: "diagnostics/doctor.json is missing required fields.",
      status: "invalid",
    });
  });
});
