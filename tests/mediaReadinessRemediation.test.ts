import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath, writeRunText } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveRender } from "../src/stages/approveRender";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { renderDraft } from "../src/stages/render";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import {
  createFakeFfmpeg,
  createFakeFfprobe,
  createMinimalRenderAssets,
  enableDeterministicTts,
  renderToolRoot,
} from "./renderTestHelpers";
import { prepareApprovedStaticVisuals } from "./visualTestHelpers";

describe("media readiness remediation", () => {
  useTempProject();

  it("prints remediation when existing voiceover evidence is stale", async () => {
    const runId = await prepareVoiceoverReadyRun();
    const metaPath = artifactPath(runId, "production/audio/voiceover.meta.json");
    const meta = await readJsonFile<Record<string, unknown>>(metaPath);
    await writeJson(metaPath, {
      ...meta,
      renderPlan: { path: "production/render_plan.json", digest: "0".repeat(64) },
    });

    const readiness = await runReadiness(runId);

    expect(
      readiness.checks.find((check) => check.name === "voiceover audio available"),
    ).toMatchObject({
      status: "block",
      message: expect.stringMatching(/stale or missing render plan/i),
      nextAction: `pnpm producer voice --run ${runId}`,
    });
  });

  it("prints TTS configuration remediation when stale voiceover cannot be regenerated", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await configureTts({ enabled: false, mode: "deterministic-local" });
    const metaPath = artifactPath(runId, "production/audio/voiceover.meta.json");
    const meta = await readJsonFile<Record<string, unknown>>(metaPath);
    await writeJson(metaPath, {
      ...meta,
      renderPlan: { path: "production/render_plan.json", digest: "0".repeat(64) },
    });

    const readiness = await runReadiness(runId);

    expect(
      readiness.checks.find((check) => check.name === "voiceover audio available"),
    ).toMatchObject({
      status: "block",
      nextAction: `Enable a TTS provider in producer.config.json, then pnpm producer voice --run ${runId}`,
    });
  });

  it("prints render approval remediation when draft evidence blocks before approval", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await writeInvalidDraftRenderArtifacts(runId);

    const readiness = await runReadiness(runId);

    expect(readiness.checks.find((check) => check.name === "draft render available")).toMatchObject(
      {
        status: "block",
        nextAction: `Repair voiceover/render evidence, then pnpm producer approve render --run ${runId}`,
      },
    );
  });

  it("prints render command remediation when approved draft evidence is blocked", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    await writeInvalidDraftRenderArtifacts(runId);

    const readiness = await runReadiness(runId);

    expect(readiness.checks.find((check) => check.name === "draft render available")).toMatchObject(
      { status: "block", nextAction: `pnpm producer render --run ${runId}` },
    );
  });

  it("prints remediation when persisted draft render evidence is blocked", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    await renderDraft(runId, {
      ffmpegBinary: await createFakeFfmpeg(renderToolRoot("persisted-draft-evidence")),
      ffprobeBinary: await createFakeFfprobe(renderToolRoot("persisted-draft-evidence")),
      maxDurationSeconds: 2,
    });
    const manifestPath = artifactPath(runId, "production/render/render_manifest.json");
    const manifest = await readJsonFile<Record<string, unknown>>(manifestPath);
    await writeJson(manifestPath, {
      ...manifest,
      output: { ...(manifest.output as Record<string, unknown>), sha256: "0".repeat(64) },
    });

    const readiness = await runReadiness(runId);

    expect(readiness.checks.find((check) => check.name === "draft render available")).toMatchObject(
      {
        status: "block",
        message: expect.stringMatching(/does not match manifest/i),
        nextAction: expect.stringContaining(`pnpm producer evidence --run ${runId}`),
      },
    );
  });
});

async function prepareVoiceoverReadyRun(): Promise<string> {
  const runId = await prepareReadyRunWithoutVoiceover();
  await generateVoiceoverAudio(runId);
  return runId;
}

async function prepareReadyRunWithoutVoiceover(): Promise<string> {
  await enableDeterministicTts(process.cwd());
  await createMinimalRenderAssets();
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  await prepareApprovedStaticVisuals(runId);
  await generateRenderPlan(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  const readiness = await runReadiness(runId);
  expect(readiness.passed).toBe(true);
  return runId;
}

async function writeJson(target: string, value: unknown): Promise<void> {
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function configureTts(tts: { enabled: boolean; mode: string }): Promise<void> {
  const config = JSON.parse(await readFile("producer.config.json", "utf8")) as {
    providers: { tts: Record<string, unknown> };
  };
  config.providers.tts = tts;
  await writeJson("producer.config.json", config);
}

async function writeInvalidDraftRenderArtifacts(runId: string): Promise<void> {
  let run = await loadRun(runId);
  for (const artifact of [
    "production/render/draft.mp4",
    "production/render/render_manifest.json",
    "production/render/draft_review.md",
  ]) {
    run = await writeRunText(run, "test", artifact, "invalid draft evidence");
  }
  await saveRun(run);
}
