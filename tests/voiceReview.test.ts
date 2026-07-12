import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";
import { readRenderPlanEvidence } from "../src/stages/renderPlan";
import { formatVoiceoverReviewConsole, reviewVoiceover } from "../src/stages/reviewVoiceover";
import type { VoiceoverAudioMeta } from "../src/stages/voice/voiceoverEvidence";
import { renderVoiceoverReviewMarkdown } from "../src/stages/voice/voiceoverReviewMarkdown";
import { useTempProject } from "./helpers";
import { prepareReadyRunWithoutVoiceover, prepareVoiceoverReadyRun } from "./renderPipelineHelpers";

const repoRoot = process.cwd();

describe("voiceover review handoff", () => {
  useTempProject();

  it("shows a safe local audio review handoff before render approval", async () => {
    const runId = await prepareVoiceoverReadyRun();

    const handoff = await reviewVoiceover(runId);

    expect(handoff).toMatchObject({
      audioPath: "production/audio/voiceover.wav",
      localPlaybackPath: `runs/${runId}/production/audio/voiceover.wav`,
      mode: "deterministic-local",
      nextSafeAction: expect.stringContaining("local timing draft"),
      productionVoiceCandidate: false,
      quality: "deterministic-local-reference",
      renderApprovalCommand: `pnpm producer approve render --run ${runId}`,
      renderApprovalScope: "timing-draft-only",
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
    expect(output).toContain(`Local playback path: runs/${runId}/production/audio/voiceover.wav`);
    expect(output).toContain("Production voice candidate: false");
    expect(output).toContain("Render approval scope: timing-draft-only");
    expect(output).toContain(
      `Render approval command: pnpm producer approve render --run ${runId}`,
    );
    expect(output).toContain(
      `Read production/audio/voiceover_review.md and listen to runs/${runId}/production/audio/voiceover.wav`,
    );
    expect(output).toContain(`pnpm producer approve render --run ${runId}`);
    expect(output).not.toContain("Listen to production/audio/voiceover_review.md");
  });

  it("shows a production-candidate render approval scope for local Piper evidence", async () => {
    const runId = await prepareReadyRunWithoutVoiceover();
    await writeLocalPiperVoiceover(runId);

    const handoff = await reviewVoiceover(runId);

    expect(handoff).toMatchObject({
      mode: "local-piper",
      nextSafeAction: expect.stringContaining("if voice quality passes"),
      productionVoiceCandidate: true,
      quality: "local-piper",
      renderApprovalCommand: `pnpm producer approve render --run ${runId}`,
      renderApprovalScope: "production-voice-candidate",
      runId,
    });
    expect(formatVoiceoverReviewConsole(handoff)).toContain(
      "Render approval scope: production-voice-candidate",
    );
  });

  it("prints parseable JSON from the CLI", async () => {
    const runId = await prepareVoiceoverReadyRun();

    const result = runCli(["review", "voice", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      audioPath: "production/audio/voiceover.wav",
      localPlaybackPath: `runs/${runId}/production/audio/voiceover.wav`,
      nextSafeAction: expect.stringContaining(`--run ${runId}`),
      runId,
    });
  });

  it("points generated voiceover output at the read-only voice review command", async () => {
    const runId = await prepareReadyRunWithoutVoiceover();

    const result = runCli(["voice", "--run", runId]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Voiceover generated: production/audio/voiceover.wav");
    expect(result.stdout).toContain(
      `Local playback path: runs/${runId}/production/audio/voiceover.wav`,
    );
    expect(result.stdout).toContain("Review artifact: production/audio/voiceover_review.md");
    expect(result.stdout).toContain(`Next safe action: pnpm producer review voice --run ${runId}`);
    expect(result.stdout).toContain("Production voice candidate: false");
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

async function writeLocalPiperVoiceover(runId: string): Promise<void> {
  const run = await loadRun(runId);
  const renderPlan = await readRenderPlanEvidence(run);
  expect(renderPlan.status).toBe("pass");
  if (renderPlan.status !== "pass") {
    throw new Error("Test fixture requires passing render plan evidence.");
  }

  const audio = Buffer.from("RIFF local piper fixture WAVE");
  const sha256 = createHash("sha256").update(audio).digest("hex");
  const meta: VoiceoverAudioMeta = {
    createdAt: "2026-06-30T12:00:00.000Z",
    mode: "local-piper",
    output: {
      bytes: audio.byteLength,
      channels: 1,
      durationSeconds: 7,
      path: "production/audio/voiceover.wav",
      sampleRateHz: 22_050,
      sha256,
    },
    provider: {
      binary: "piper",
      configPath: "models/piper/tr_TR-test.onnx.json",
      configSha256: "e".repeat(64),
      modelPath: "models/piper/tr_TR-test.onnx",
      modelSha256: "d".repeat(64),
    },
    quality: "local-piper",
    renderPlan: { digest: renderPlan.digest, path: "production/render_plan.json" },
    runId,
    schemaVersion: 1,
    source: { path: "production/voiceover.txt", sha256: "b".repeat(64), wordCount: 42 },
  };

  await mkdir(path.dirname(artifactPath(runId, "production/audio/voiceover.wav")), {
    recursive: true,
  });
  await writeFile(artifactPath(runId, "production/audio/voiceover.wav"), audio);
  await writeFile(
    artifactPath(runId, "production/audio/voiceover.meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    artifactPath(runId, "production/audio/voiceover_review.md"),
    renderVoiceoverReviewMarkdown(meta),
    "utf8",
  );
  await saveRun({
    ...run,
    artifacts: Array.from(
      new Set([
        ...run.artifacts,
        "production/audio/voiceover.wav",
        "production/audio/voiceover.meta.json",
        "production/audio/voiceover_review.md",
      ]),
    ),
  });
}
