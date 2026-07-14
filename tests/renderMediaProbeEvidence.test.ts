import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { approveIdea } from "../src/stages/approveIdea";
import { approveRender } from "../src/stages/approveRender";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { renderDraft } from "../src/stages/render";
import type { DraftRenderEvidence } from "../src/stages/renderEvidence";
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

describe("draft render media probe evidence", () => {
  useTempProject();

  it("blocks stale draft render evidence when media probe data is missing", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    await renderDraft(runId, {
      ffmpegBinary: await createFakeFfmpeg(renderToolRoot("missing-probe")),
      ffprobeBinary: await createFakeFfprobe(renderToolRoot("missing-probe")),
      maxDurationSeconds: 1,
    });

    const manifestPath = artifactPath(runId, "production/render/render_manifest.json");
    const manifest = await readJsonFile<Record<string, unknown>>(manifestPath);
    delete manifest.mediaProbe;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const evidence = (await generateEvidenceBundle(runId)) as {
      draftRender: Extract<DraftRenderEvidence, { status: "block" }>;
    };
    expect(evidence.draftRender).toMatchObject({
      status: "block",
      path: "production/render/draft.mp4",
      message: expect.stringMatching(/mediaProbe|Invalid input/i),
    });

    expect((await runReadiness(runId)).checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "draft render available",
          nextAction: `Regenerate evidence with pnpm producer evidence --run ${runId}; if draft artifacts remain blocked, revise upstream artifacts before a new render approval.`,
          status: "block",
        }),
      ]),
    );
  });
});

async function prepareVoiceoverReadyRun(): Promise<string> {
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
  expect((await runReadiness(runId)).passed).toBe(true);
  await generateVoiceoverAudio(runId);
  return runId;
}
