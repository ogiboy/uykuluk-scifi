import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { runIdeas } from "../src/stages/ideas";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();

describe("producer evidence CLI", () => {
  useTempProject();

  it("prints parseable JSON evidence bundles for automation", async () => {
    const { runId } = await runIdeas();
    const result = runCli(["evidence", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      runId,
      currentState: "IDEAS_GENERATED",
      generatedArtifacts: expect.arrayContaining(["ideas.json", "ideas.md"]),
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
