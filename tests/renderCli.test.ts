import { spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveRender } from "../src/stages/approveRender";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import {
  createFakeFfmpeg,
  createFakeFfprobe,
  createMinimalRenderAssets,
  enableDeterministicTts,
  renderToolRoot,
} from "./renderTestHelpers";

const repoRoot = process.cwd();

describe("producer render CLI", () => {
  useTempProject();

  it("prints parseable JSON draft render manifests for automation", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    const fakeBinPath = await createFakeRenderPath(renderToolRoot("cli-path"));

    const result = runCli(["render", "--run", runId, "--json"], {
      PATH: `${fakeBinPath}${path.delimiter}${process.env.PATH ?? ""}`,
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      schemaVersion: 8,
      runId,
      chapterDraft: {
        jsonPath: "production/render/youtube_chapters.json",
        jsonSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        markdownPath: "production/render/youtube_chapters.md",
        markdownSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      renderApproval: {
        approvalId: expect.stringMatching(/^approval_/),
        approvedRef: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      renderPlan: {
        path: "production/render_plan.json",
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      voiceoverAudio: {
        path: "production/audio/voiceover.wav",
        mode: "deterministic-local",
        productionVoiceCandidate: false,
        quality: "deterministic-local-reference",
      },
      ffmpegTimelineInputs: expect.arrayContaining([
        expect.objectContaining({
          asset: expect.objectContaining({ path: "assets/intro/frames/intro_frame_00.jpg" }),
          durationSeconds: 1,
          frameIndex: 1,
          segment: "intro",
          source: "source-frame",
        }),
        expect.objectContaining({
          asset: expect.objectContaining({ path: "assets/intro/frames/intro_frame_01.jpg" }),
          durationSeconds: 1,
          frameIndex: 2,
          segment: "intro",
          source: "source-frame",
        }),
        expect.objectContaining({
          asset: expect.objectContaining({ path: "assets/backgrounds/plate_test_1920x1080.jpg" }),
          segment: "scene",
          source: "background",
        }),
        expect.objectContaining({
          asset: expect.objectContaining({ path: "assets/outro/frames/outro_frame_00.jpg" }),
          frameIndex: 1,
          segment: "outro",
          source: "source-frame",
        }),
        expect.objectContaining({
          asset: expect.objectContaining({ path: "assets/outro/frames/outro_frame_01.jpg" }),
          frameIndex: 2,
          segment: "outro",
          source: "source-frame",
        }),
      ]),
      output: {
        path: "production/render/draft.mp4",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      mediaProbe: { audio: { codecName: "aac" }, video: { height: 720, width: 1280 } },
      ffmpeg: { reviewCommand: expect.stringContaining("production/render/draft.mp4") },
    });
    await expect(loadRun(runId)).resolves.toMatchObject({
      artifacts: expect.arrayContaining([
        "production/render/draft.mp4",
        "production/render/render_manifest.json",
      ]),
      state: "RENDERED",
    });
    await expect(pathExists(artifactPath(runId, "production/render/draft.mp4"))).resolves.toBe(
      true,
    );
  });

  it("prints a local-only review handoff after draft rendering", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    const fakeBinPath = await createFakeRenderPath(renderToolRoot("cli-handoff"));

    const result = runCli(["render", "--run", runId], {
      PATH: `${fakeBinPath}${path.delimiter}${process.env.PATH ?? ""}`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Draft render available: production/render/draft.mp4");
    expect(result.stdout).toContain("Review document: production/render/draft_review.md");
    expect(result.stdout).toContain("Manifest: production/render/render_manifest.json");
    expect(result.stdout).toContain("FFmpeg review command:");
    expect(result.stdout).toContain(artifactPath(runId, "production/render/draft.mp4"));
    expect(result.stdout).toContain("upload and publish remain disabled");
    expect(result.stdout).toContain("After review, record exactly one local decision:");
    expect(result.stdout).toContain(`pnpm producer decide render --run ${runId}`);
    expect(result.stdout).toContain("--decision accepted-for-local-review");

    const review = runCli(["review", "render", "--run", runId]);

    expect(review.status).toBe(0);
    expect(review.stdout).toContain("Draft render available: production/render/draft.mp4");
    expect(review.stdout).toContain("Review document: production/render/draft_review.md");
    expect(review.stdout).toContain("upload and publish remain disabled");
    expect(review.stdout).toContain(`pnpm producer decide render --run ${runId}`);

    await expect(
      readFile(artifactPath(runId, "production/render/draft_review.md"), "utf8"),
    ).resolves.toContain("## Decision Commands");
    await expect(
      readFile(artifactPath(runId, "production/render/draft_review.md"), "utf8"),
    ).resolves.toContain(`pnpm producer decide render --run ${runId}`);
  });

  it("blocks render review before a draft render exists", async () => {
    const runId = await prepareVoiceoverReadyRun();

    const result = runCli(["review", "render", "--run", runId]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Draft render review is not available yet");
  });
});

function runCli(
  args: string[],
  env: Partial<NodeJS.ProcessEnv> = {},
): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    [path.join(repoRoot, "src", "cli.ts"), ...args],
    { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, ...env } },
  );
  return {
    status: result.status,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}

async function prepareVoiceoverReadyRun(): Promise<string> {
  await enableDeterministicTts(process.cwd());
  await createMinimalRenderAssets();
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  await generateRenderPlan(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  const readiness = await runReadiness(runId);
  expect(readiness.passed).toBe(true);
  await generateVoiceoverAudio(runId);
  return runId;
}

async function createFakeRenderPath(root: string): Promise<string> {
  const fakeBinPath = path.join(root, "fake-render-bin");
  await mkdir(fakeBinPath, { recursive: true });
  await createFakeFfmpeg(fakeBinPath, "ffmpeg");
  await createFakeFfprobe(fakeBinPath, "ffprobe");
  return fakeBinPath;
}
