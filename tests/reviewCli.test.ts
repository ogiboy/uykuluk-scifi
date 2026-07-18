import { describe, expect, it } from "vitest";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";
import { runProducerCliForTest } from "./producerCliTestHelper";

describe("producer review CLI", () => {
  useTempProject();

  it("prints parseable JSON script review results for automation", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);

    const result = runCli(["review", "script", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      runId,
      scriptHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      warningCount: expect.any(Number),
      blockerCount: expect.any(Number),
      warnings: expect.any(Array),
    });
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "SCRIPT_REVIEWED" });
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  return runProducerCliForTest(args);
}
