import { readFile, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import {
  ttsConfigurationDigest,
  voiceAuditionArtifactRevision,
} from "../src/stages/voice/catalog/voiceAuditionRevision";
import { useTempProject } from "./helpers";
import { elevenLabsTtsConfig, writeSelectedAuditionArtifacts } from "./statusEvidenceFixtures";
import { studioEvidenceFixture } from "./studioRunFixtures";
import { preparePaidVoiceSelection } from "./voiceAuditionStageFixtures";
import { configureElevenLabs } from "./voiceCatalogStageFixtures";

describe("status evidence freshness", () => {
  useTempProject();
  afterEach(() => vi.useRealTimers());

  it.each(["catalog", "previewEvidence", "previewAudio", "selection"] as const)(
    "marks same-state evidence stale when selected %s bytes are tampered",
    async (tamperedRole) => {
      await configureElevenLabs();
      const run = await createRun();
      const selectedArtifacts = await writeSelectedAuditionArtifacts(run.runId, "tamper");
      const currentArtifacts = [...Object.values(selectedArtifacts), "evidence_bundle.json"];
      await saveRun({ ...run, artifacts: currentArtifacts, state: "PRODUCTION_PACKAGE_GENERATED" });
      const voiceAuditionRevision = await voiceAuditionArtifactRevision(
        { runId: run.runId, artifacts: currentArtifacts },
        Object.values(selectedArtifacts),
      );
      await writeFile(
        artifactPath(run.runId, "evidence_bundle.json"),
        JSON.stringify(
          studioEvidenceFixture(
            run.runId,
            "PRODUCTION_PACKAGE_GENERATED",
            {
              voiceAuditionRevision,
              ttsConfigurationDigest: ttsConfigurationDigest(elevenLabsTtsConfig()),
              voiceSelection: {
                status: "current",
                path: selectedArtifacts.selection,
                digest: "a".repeat(64),
                validUntil: "2027-01-01T00:00:00.000Z",
                artifacts: selectedArtifacts,
              },
            },
            currentArtifacts,
          ),
        ),
        "utf8",
      );
      await writeFile(
        artifactPath(run.runId, selectedArtifacts[tamperedRole]),
        '{"tampered":true}',
        "utf8",
      );

      const output = formatRunStatus(await readRunStatus(run.runId));

      expect(output).toContain(
        "Evidence: stale (evidence_bundle.json does not match current selected voice evidence.)",
      );
    },
  );

  it("marks evidence stale when its selected voice catalog freshness expires", async () => {
    vi.useFakeTimers();
    const catalogTime = new Date("2026-07-13T08:00:00.000Z");
    vi.setSystemTime(catalogTime);
    const { runId } = await preparePaidVoiceSelection();
    await generateEvidenceBundle(runId);
    vi.setSystemTime(new Date(catalogTime.getTime() + 2 * 60 * 60 * 1_000));

    const output = formatRunStatus(await readRunStatus(runId));

    expect(output).toContain(
      "Evidence: stale (evidence_bundle.json voice catalog freshness has expired.)",
    );
  });

  it("keeps completed historical evidence available after catalog expiry", async () => {
    const run = await createRun();
    const selectedArtifacts = await writeSelectedAuditionArtifacts(run.runId, "historical");
    const currentArtifacts = [...Object.values(selectedArtifacts), "evidence_bundle.json"];
    await saveRun({ ...run, artifacts: currentArtifacts, state: "RENDERED" });
    const voiceAuditionRevision = await voiceAuditionArtifactRevision(
      { runId: run.runId, artifacts: currentArtifacts },
      Object.values(selectedArtifacts),
    );
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(
          run.runId,
          "RENDERED",
          {
            voiceAuditionRevision,
            ttsConfigurationDigest: ttsConfigurationDigest(elevenLabsTtsConfig()),
            voiceSelection: {
              status: "current",
              path: selectedArtifacts.selection,
              digest: "a".repeat(64),
              validUntil: "2026-01-01T00:00:00.000Z",
              artifacts: selectedArtifacts,
            },
          },
          currentArtifacts,
        ),
      ),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Evidence: available");
  });

  it("marks pre-execution evidence stale when TTS provider configuration changes", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["evidence_bundle.json"],
      state: "PRODUCTION_PACKAGE_GENERATED",
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(
          run.runId,
          "PRODUCTION_PACKAGE_GENERATED",
          { nextRecommendedCommand: "pnpm producer estimate --run <run_id>" },
          ["evidence_bundle.json"],
        ),
      ),
      "utf8",
    );
    await writeFile(
      "producer.config.json",
      JSON.stringify({
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: { ...defaultConfig.providers.tts, enabled: true, mode: "elevenlabs" },
        },
      }),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Evidence: stale (evidence_bundle.json does not match current TTS configuration.)",
    );
  });

  it("reports config drift before revalidating an existing selected voice", async () => {
    const { runId } = await preparePaidVoiceSelection();
    await generateEvidenceBundle(runId);
    await configureElevenLabs({ outputFormat: "wav_48000" });

    const output = formatRunStatus(await readRunStatus(runId));

    expect(output).toContain(
      "Evidence: stale (evidence_bundle.json does not match current TTS configuration.)",
    );
  });

  it.each([
    {
      label: "hosted config with not-required evidence",
      tts: { ...defaultConfig.providers.tts, enabled: true, mode: "elevenlabs" as const },
      voiceSelection: { status: "not-required" as const },
    },
    {
      label: "local config with hosted-selection evidence",
      tts: { ...defaultConfig.providers.tts, enabled: true, mode: "local-piper" as const },
      voiceSelection: { status: "missing-or-invalid" as const },
    },
  ])("rejects $label even when its config digest matches", async ({ tts, voiceSelection }) => {
    const run = await createRun();
    const currentArtifacts = ["evidence_bundle.json"];
    await saveRun({ ...run, artifacts: currentArtifacts, state: "PRODUCTION_PACKAGE_GENERATED" });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(
          run.runId,
          "PRODUCTION_PACKAGE_GENERATED",
          { ttsConfigurationDigest: ttsConfigurationDigest(tts), voiceSelection },
          currentArtifacts,
        ),
      ),
      "utf8",
    );
    await writeFile(
      "producer.config.json",
      JSON.stringify({ ...defaultConfig, providers: { ...defaultConfig.providers, tts } }),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Evidence: stale (evidence_bundle.json voice selection requirement does not match current TTS provider.)",
    );
  });

  it("reports selected-voice evidence from an older state as stale before artifact IO", async () => {
    const { runId } = await preparePaidVoiceSelection();
    await generateEvidenceBundle(runId);
    const run = await loadRun(runId);
    await saveRun({ ...run, state: "COST_ESTIMATED" });

    const output = formatRunStatus(await readRunStatus(runId));

    expect(output).toContain(
      "Evidence: stale (evidence_bundle.json was generated for PRODUCTION_PACKAGE_GENERATED, but the run is COST_ESTIMATED.)",
    );
  });

  it("reports selected-voice evidence for a different run before artifact IO", async () => {
    const { runId } = await preparePaidVoiceSelection();
    await generateEvidenceBundle(runId);
    const evidencePath = artifactPath(runId, "evidence_bundle.json");
    const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as Record<string, unknown>;
    evidence.runId = "run_20260713000000_deadbe";
    await writeFile(evidencePath, JSON.stringify(evidence), "utf8");

    const output = formatRunStatus(await readRunStatus(runId));

    expect(output).toContain("Evidence: stale (evidence_bundle.json belongs to a different run.)");
  });
});
