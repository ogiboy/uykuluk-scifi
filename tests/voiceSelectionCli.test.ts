import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { useTempProject } from "./helpers";
import {
  configureElevenLabs,
  preparePackagedRun,
  successfulCatalogProvider,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

const repoRoot = process.cwd();

describe("producer voice selection CLI", () => {
  useTempProject();

  it("prints parseable exact selection JSON without making another provider call", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    const catalog = await generateVoiceCandidates(runId, { provider: successfulCatalogProvider() });
    const voiceId = catalog.candidates[0].voiceId;
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });

    const result = runCli([
      "voice-select",
      "--run",
      runId,
      "--voice",
      voiceId,
      "--reviewed-by",
      "cli-operator",
      "--notes",
      "CLI audition reviewed locally",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      schemaVersion: 1,
      runId,
      selectedBy: "cli-operator",
      voice: { voiceId, productionEligibility: { status: "preview-only" } },
      selectionDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
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
