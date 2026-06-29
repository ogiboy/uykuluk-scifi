import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createRun } from "../src/core/runStore";
import { formatVoiceoverReviewConsole, reviewVoiceover } from "../src/stages/reviewVoiceover";
import { useTempProject } from "./helpers";
import { prepareVoiceoverReadyRun } from "./renderPipelineHelpers";

const repoRoot = process.cwd();

describe("voiceover review handoff", () => {
  useTempProject();

  it("shows a safe local audio review handoff before render approval", async () => {
    const runId = await prepareVoiceoverReadyRun();

    const handoff = await reviewVoiceover(runId);

    expect(handoff).toMatchObject({
      audioPath: "production/audio/voiceover.wav",
      mode: "deterministic-local",
      nextSafeAction: expect.stringContaining("local timing draft"),
      productionVoiceCandidate: false,
      quality: "deterministic-local-reference",
      reviewPath: "production/audio/voiceover_review.md",
      runId,
    });
    expect(handoff.blockedActions).toEqual(
      expect.arrayContaining([
        "Final production voice remains blocked until reviewed local Piper audio exists.",
        "Private upload, scheduled publish, and public publish remain disabled.",
      ]),
    );

    const output = formatVoiceoverReviewConsole(handoff);
    expect(output).toContain(`Run: ${runId}`);
    expect(output).toContain("Production voice candidate: false");
    expect(output).toContain(`pnpm producer approve render --run ${runId}`);
  });

  it("prints parseable JSON from the CLI", async () => {
    const runId = await prepareVoiceoverReadyRun();

    const result = runCli(["review", "voice", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      audioPath: "production/audio/voiceover.wav",
      nextSafeAction: expect.stringContaining(`--run ${runId}`),
      runId,
    });
  });

  it("blocks review when voiceover evidence is missing", async () => {
    const run = await createRun();

    const result = runCli(["review", "voice", "--run", run.runId]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Voiceover review requires generated audio");
    expect(result.stderr).toContain(`pnpm producer voice --run ${run.runId}`);
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
