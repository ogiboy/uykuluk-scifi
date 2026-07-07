import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { runIdeas } from "../src/stages/ideas";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();

describe("producer package CLI", () => {
  useTempProject();

  it("prints parseable JSON production package manifests for automation", async () => {
    const runId = await prepareApprovedScriptRun();

    const result = runCli(["package", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      schemaVersion: 1,
      runId,
      prompt: { key: "production-package", artifact: "production/production_package.md" },
      artifacts: expect.arrayContaining([
        expect.objectContaining({ path: "production/voiceover.txt" }),
        expect.objectContaining({ path: "production/subtitles.srt" }),
        expect.objectContaining({ path: "production/scenes.json" }),
        expect.objectContaining({ path: "production/youtube_metadata.json" }),
        expect.objectContaining({ path: "production/production_package.md" }),
      ]),
    });
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "PRODUCTION_PACKAGE_GENERATED" });
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

async function prepareApprovedScriptRun(): Promise<string> {
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  return runId;
}
