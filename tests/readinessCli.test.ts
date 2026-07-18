import { describe, expect, it } from "vitest";
import { runIdeas } from "../src/stages/ideas";
import { useTempProject } from "./helpers";
import { runProducerCliForTest } from "./producerCliTestHelper";

describe("producer readiness CLI", () => {
  useTempProject();

  it("prints parseable JSON diagnostics when readiness blocks", async () => {
    const { runId } = await runIdeas();
    const result = runCli(["readiness", "--run", runId, "--json"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Readiness blocked.");
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      passed: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "script generated", status: "block" }),
      ]),
    });
    expect(result.stdout).toContain(`pnpm producer estimate --run ${runId}`);
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  return runProducerCliForTest(args);
}
