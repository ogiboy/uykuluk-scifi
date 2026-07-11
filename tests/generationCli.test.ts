import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();

describe("producer generation CLI", () => {
  useTempProject();

  it("prints parseable JSON ideas for automation", async () => {
    const result = runCli(["ideas", "--json"]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      ideas: Array<{ id: string; title: string }>;
      runId: string;
    };
    expect(payload).toMatchObject({
      runId: expect.stringMatching(/^run_/),
      ideas: expect.arrayContaining([
        expect.objectContaining({ id: expect.stringMatching(/^idea_/) }),
      ]),
    });
    await expect(loadRun(payload.runId)).resolves.toMatchObject({ state: "IDEAS_GENERATED" });
  });

  it("prints parseable JSON script metadata for automation", async () => {
    const { runId, ideas } = JSON.parse(runCli(["ideas", "--json"]).stdout) as {
      ideas: Array<{ id: string }>;
      runId: string;
    };
    await approveIdea(runId, ideas[0].id);

    const result = runCli(["script", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      wordCount: expect.any(Number),
      tone: expect.any(String),
      sectionCount: expect.any(Number),
      prompt: { key: "script", artifact: "script.md" },
    });
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "SCRIPT_GENERATED" });
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
