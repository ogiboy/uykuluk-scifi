import path from "node:path";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();

describe("producer revision CLI", () => {
  useTempProject();

  it("prints parseable JSON script revisions for automation", async () => {
    const runId = await reviewedScriptRun();
    const current = await readFile(artifactPath(runId, "script.md"), "utf8");
    await writeFile("revised-script.md", `${current.trim()}\n\nOperatör revizyon notu.\n`, "utf8");

    const result = runCli([
      "revise",
      "script",
      "--run",
      runId,
      "--file",
      "revised-script.md",
      "--reason",
      "Operatör düzeltmesi",
      "--editor",
      "ogiboy",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      artifact: "script.md",
      editor: "ogiboy",
      nextState: "SCRIPT_GENERATED",
      previousState: "SCRIPT_REVIEWED",
      reason: "Operatör düzeltmesi",
      runId,
    });
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "SCRIPT_GENERATED" });
  });

  it("prints parseable JSON package artifact revisions for automation", async () => {
    const runId = await packagedRun();
    await writeFile(
      "revised-subtitles.srt",
      "1\n00:00:00,000 --> 00:00:03,000\nRevize altyazı.\n",
      "utf8",
    );

    const result = runCli([
      "revise",
      "package-artifact",
      "--run",
      runId,
      "--artifact",
      "subtitles",
      "--file",
      "revised-subtitles.srt",
      "--reason",
      "Altyazı okunurluğu",
      "--editor",
      "ogiboy",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      artifactKey: "subtitles",
      artifactPath: "production/subtitles.srt",
      editor: "ogiboy",
      previousState: "PRODUCTION_PACKAGE_GENERATED",
      reason: "Altyazı okunurluğu",
      runId,
      schemaVersion: 1,
    });
    await expect(loadRun(runId)).resolves.toMatchObject({
      state: "PRODUCTION_PACKAGE_GENERATED",
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

async function reviewedScriptRun(): Promise<string> {
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  return runId;
}

async function packagedRun(): Promise<string> {
  const runId = await reviewedScriptRun();
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}
