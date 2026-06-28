import path from "node:path";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveRender } from "../src/stages/approveRender";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { estimateCost } from "../src/stages/estimate";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { runReadiness } from "../src/stages/readiness";
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
      schemaVersion: 4,
      runId,
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
      output: {
        path: "production/render/draft.mp4",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      mediaProbe: {
        audio: { codecName: "aac" },
        video: { height: 720, width: 1280 },
      },
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
});

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv = {},
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
