import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveRender } from "../src/stages/approveRender";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { renderDraft } from "../src/stages/render";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import { prepareReadyRunWithoutVoiceover, prepareVoiceoverReadyRun } from "./renderPipelineHelpers";
import { createFakeFfmpeg, renderToolRoot } from "./renderTestHelpers";

describe("draft render approval gates", () => {
  useTempProject();

  it("requires explicit render approval before generating a draft video", async () => {
    const runId = await prepareVoiceoverReadyRun();
    const ffmpeg = await createFakeFfmpeg(renderToolRoot("approval-required"));
    const evidence = (await generateEvidenceBundle(runId)) as { nextRecommendedCommand: string };

    expect(evidence.nextRecommendedCommand).toBe(`pnpm producer review voice --run ${runId}`);

    await expect(
      renderDraft(runId, { ffmpegBinary: ffmpeg, maxDurationSeconds: 1 }),
    ).rejects.toThrow(/render approval/i);
    expect(await pathExists(artifactPath(runId, "production/render/draft.mp4"))).toBe(false);
  });

  it("blocks render approval until voiceover audio evidence exists", async () => {
    const runId = await prepareReadyRunWithoutVoiceover();

    await expect(approveRender(runId)).rejects.toThrow(/voiceover/i);
    expect((await loadRun(runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
  });

  it("refuses approval for a readable legacy render plan without visual binding", async () => {
    const runId = await prepareVoiceoverReadyRun();
    const planPath = artifactPath(runId, "production/render_plan.json");
    const plan = JSON.parse(await readFile(planPath, "utf8")) as {
      visualManifest?: unknown;
      schemaVersion: number;
      scenes: Array<Record<string, unknown>>;
    };
    const legacyScenes = plan.scenes.map((scene) => {
      const legacyScene = { ...scene };
      delete legacyScene.motion;
      delete legacyScene.visualRevision;
      return legacyScene;
    });
    const legacyPlan: Record<string, unknown> = { ...plan, schemaVersion: 1, scenes: legacyScenes };
    delete legacyPlan.visualManifest;
    await writeFile(planPath, `${JSON.stringify(legacyPlan, null, 2)}\n`, "utf8");

    await expect(approveRender(runId)).rejects.toThrow(/visual-manifest-bound/i);
  });
});
