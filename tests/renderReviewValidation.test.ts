import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { approveRender } from "../src/stages/approveRender";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { renderDraft } from "../src/stages/render";
import type { DraftRenderEvidence, DraftRenderManifest } from "../src/stages/renderEvidence";
import { reviewDraftRender } from "../src/stages/reviewRender";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import { prepareVoiceoverReadyRun } from "./renderPipelineHelpers";
import { createFakeFfmpeg, createFakeFfprobe, renderToolRoot } from "./renderTestHelpers";

describe("draft render review validation", () => {
  useTempProject();

  it("blocks direct review before a draft render exists", async () => {
    const runId = await prepareVoiceoverReadyRun();

    await expect(reviewDraftRender(runId)).rejects.toThrow(/not available yet/i);
  });

  it("returns the validated final draft manifest for read-only review", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    const ffmpeg = await createFakeFfmpeg(renderToolRoot("valid-review-command"));
    const ffprobe = await createFakeFfprobe(renderToolRoot("valid-review-command"));

    await renderDraft(runId, { ffmpegBinary: ffmpeg, ffprobeBinary: ffprobe });

    await expect(reviewDraftRender(runId)).resolves.toMatchObject({
      output: { path: "production/render/draft.mp4" },
      runId,
    });
  });

  it("blocks evidence and review handoff when persisted review command provenance is tampered", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    const ffmpeg = await createFakeFfmpeg(renderToolRoot("tampered-review-command"));
    const ffprobe = await createFakeFfprobe(renderToolRoot("tampered-review-command"));

    await renderDraft(runId, { ffmpegBinary: ffmpeg, ffprobeBinary: ffprobe });
    const manifestPath = artifactPath(runId, "production/render/render_manifest.json");
    const manifest = await readJsonFile<DraftRenderManifest>(manifestPath);
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          ...manifest,
          ffmpeg: { ...manifest.ffmpeg, reviewCommand: "echo unsafe" },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const evidence = (await generateEvidenceBundle(runId)) as {
      draftRender: DraftRenderEvidence;
    };
    expect(evidence.draftRender).toMatchObject({
      message: expect.stringContaining("review command"),
      status: "block",
    });
    await expect(reviewDraftRender(runId)).rejects.toThrow(/review command/i);
  });
});
