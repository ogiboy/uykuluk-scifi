import { describe, expect, it } from "vitest";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { prepareApprovedSelectedVoiceRun } from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import { runProducerCliForTest } from "./producerCliTestHelper";
import {
  configureElevenLabs,
  preparePackagedRun,
  successfulCatalogProvider,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

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

  it("prints parseable pre-spend reselection recovery evidence", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();

    const result = runCli([
      "voice-reselect",
      "--run",
      runId,
      "--reviewed-by",
      "cli-voice-director",
      "--reason",
      "voice rejected before synthesis",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      schemaVersion: 1,
      runId,
      reviewedBy: "cli-voice-director",
      nextState: "PRODUCTION_PACKAGE_GENERATED",
      previousSelection: { digest: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  return runProducerCliForTest(args);
}
