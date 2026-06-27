import path from "node:path";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();

describe("producer analytics CLI", () => {
  useTempProject();

  it("prints parseable JSON import and report results for automation", async () => {
    await writeFile(
      "performance.csv",
      [
        "run_id,video_id,title,published_at,impressions,views,ctr,avg_view_duration_seconds,avg_percentage_viewed,subscribers_gained,likes,comments,notes",
        'run_20260624010101_abcd12,yt_001,"Ay Üssünde İlk Temas",2026-06-20T12:00:00.000Z,10000,1200,7.5%,181,42%,12,90,8,"Strong hook"',
      ].join("\n"),
      "utf8",
    );

    const importResult = runCli(["analytics", "import", "--file", "performance.csv", "--json"]);

    expect(importResult.status).toBe(0);
    expect(JSON.parse(importResult.stdout) as unknown).toMatchObject({
      format: "csv",
      outputPath: "analytics/performance.json",
      recordCount: 1,
      reportPath: "analytics/performance_report.md",
    });
    await expect(readFile("analytics/performance.json", "utf8")).resolves.toContain("yt_001");

    const reportResult = runCli(["analytics", "report", "--json"]);

    expect(reportResult.status).toBe(0);
    expect(JSON.parse(reportResult.stdout) as unknown).toMatchObject({
      report: expect.stringContaining("Manual Analytics Report"),
      reportPath: "analytics/performance_report.md",
    });
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    [path.join(repoRoot, "src", "cli.ts"), ...args],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  return {
    status: result.status,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}
