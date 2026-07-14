import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun, saveRun } from "../src/core/runStore";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";
import { passingRenderedEvidence } from "./statusOutputEvidenceFixtures";
import { studioEvidenceFixture } from "./studioRunFixtures";

describe("invalid status evidence", () => {
  useTempProject();

  it("classifies unversioned evidence as legacy regeneration work", async () => {
    const run = await createRun();
    await saveRun({ ...run, artifacts: ["evidence_bundle.json"], state: "SCRIPT_APPROVED" });
    const legacy = studioEvidenceFixture(run.runId, "SCRIPT_APPROVED", {}, run.artifacts);
    delete legacy.schemaVersion;
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(legacy),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Evidence: invalid (evidence_bundle.json uses a legacy schema and must be regenerated.)",
    );
  });

  it("marks unreadable evidence JSON as invalid instead of missing", async () => {
    const run = await createRun();
    await saveRun({ ...run, artifacts: ["evidence_bundle.json"] });
    await mkdir(`runs/${run.runId}`, { recursive: true });
    await writeFile(artifactPath(run.runId, "evidence_bundle.json"), "{", "utf8");

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Evidence: invalid (evidence_bundle.json could not be parsed.)");
    expect(output).toContain(`Evidence next action: pnpm producer evidence --run ${run.runId}`);
    expect(output).toContain(
      "Production media evidence: artifact-record fallback because evidence is invalid.",
    );
  });

  it("does not require current TTS config for completed historical evidence", async () => {
    const run = await createRun();
    const currentArtifacts = ["evidence_bundle.json"];
    await saveRun({ ...run, artifacts: currentArtifacts, state: "RENDERED" });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(studioEvidenceFixture(run.runId, "RENDERED", {}, currentArtifacts)),
      "utf8",
    );
    await writeFile("producer.config.json", "{", "utf8");

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain("Evidence: available");
  });

  it("classifies malformed current TTS config separately from voice evidence", async () => {
    const run = await createRun();
    const currentArtifacts = ["evidence_bundle.json"];
    await saveRun({ ...run, artifacts: currentArtifacts, state: "PRODUCTION_PACKAGE_GENERATED" });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(run.runId, "PRODUCTION_PACKAGE_GENERATED", {}, currentArtifacts),
      ),
      "utf8",
    );
    await writeFile("producer.config.json", "{", "utf8");

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Evidence: invalid (evidence_bundle.json could not be validated against current TTS configuration.)",
    );
  });

  it("marks evidence with malformed schema fields as invalid", async () => {
    const run = await createRun();
    await saveRun({ ...run, artifacts: ["evidence_bundle.json"], state: "SCRIPT_APPROVED" });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(
          run.runId,
          "SCRIPT_APPROVED",
          { currentState: "NOT_A_RUN_STATE", generatedAt: "not-a-date" },
          run.artifacts,
        ),
      ),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Evidence: invalid (evidence_bundle.json is missing required fields.)",
    );
    expect(output).toContain(`Evidence next action: pnpm producer evidence --run ${run.runId}`);
    expect(output).toContain(
      "Production media evidence: artifact-record fallback because evidence is invalid.",
    );
  });

  it("rejects legacy passing draft-render evidence without review command provenance", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["production/render/draft.mp4", "evidence_bundle.json"],
      state: "RENDERED",
    });
    const evidence = passingRenderedEvidence(run.runId, run.artifacts);
    delete (evidence.draftRender as Record<string, unknown>).ffmpegReviewCommand;
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(evidence),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Evidence: invalid (evidence_bundle.json is missing required fields.)",
    );
    expect(output).toContain(`Evidence next action: pnpm producer evidence --run ${run.runId}`);
  });

  it("rejects legacy passing voiceover evidence without a local playback path", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["production/audio/voiceover.wav", "evidence_bundle.json"],
      state: "READY_FOR_MANUAL_PRODUCTION",
    });
    const evidence = studioEvidenceFixture(
      run.runId,
      "READY_FOR_MANUAL_PRODUCTION",
      {
        voiceoverAudio: {
          digest: "b".repeat(64),
          durationSeconds: 8.2,
          mode: "local-piper",
          path: "production/audio/voiceover.wav",
          productionVoiceCandidate: true,
          quality: "local-piper",
          reviewPath: "production/audio/voiceover_review.md",
          sourceWordCount: 42,
          status: "pass",
        },
      },
      run.artifacts,
    );
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(evidence),
      "utf8",
    );

    const output = formatRunStatus(await readRunStatus(run.runId));

    expect(output).toContain(
      "Evidence: invalid (evidence_bundle.json is missing required fields.)",
    );
    expect(output).toContain(`Evidence next action: pnpm producer evidence --run ${run.runId}`);
  });
});
