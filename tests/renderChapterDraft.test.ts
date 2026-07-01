import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveRender } from "../src/stages/approveRender";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { renderDraft } from "../src/stages/render";
import type { DraftRenderEvidence } from "../src/stages/renderEvidence";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import { prepareVoiceoverReadyRun } from "./renderPipelineHelpers";
import {
  createFailingFakeFfprobe,
  createFakeFfmpeg,
  createFakeFfprobe,
  renderToolRoot,
} from "./renderTestHelpers";

describe("draft render chapter draft evidence", () => {
  useTempProject();

  it("writes copy-ready local chapter drafts from the render timeline", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    await renderDraft(runId, {
      ffmpegBinary: await createFakeFfmpeg(renderToolRoot("chapter-draft")),
      ffprobeBinary: await createFakeFfprobe(renderToolRoot("chapter-draft")),
      maxDurationSeconds: 8,
    });

    const chapters = await readFile(
      artifactPath(runId, "production/render/youtube_chapters.md"),
      "utf8",
    );

    expect(chapters).toContain("# YouTube Chapter Draft");
    expect(chapters).toContain("0:00 Giriş");
    expect(chapters).toContain("0:02 Sahne 1");
    expect(chapters).toContain("0:05 Kapanış");
    expect(chapters).toContain("Chapter drafts do not approve private upload");
  });

  it("blocks draft render evidence when chapter draft artifacts are tampered", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    await renderDraft(runId, {
      ffmpegBinary: await createFakeFfmpeg(renderToolRoot("chapter-tamper")),
      ffprobeBinary: await createFakeFfprobe(renderToolRoot("chapter-tamper")),
      maxDurationSeconds: 8,
    });
    await writeFile(
      artifactPath(runId, "production/render/youtube_chapters.md"),
      "# Tampered chapters\n",
      "utf8",
    );

    const evidence = (await generateEvidenceBundle(runId)) as {
      draftRender: Extract<DraftRenderEvidence, { status: "block" }>;
    };

    expect(evidence.draftRender).toMatchObject({
      message: expect.stringContaining("chapter Markdown"),
      status: "block",
    });
  });

  it("blocks copied chapter JSON even when the manifest digest is updated", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    await renderDraft(runId, {
      ffmpegBinary: await createFakeFfmpeg(renderToolRoot("chapter-copied-json")),
      ffprobeBinary: await createFakeFfprobe(renderToolRoot("chapter-copied-json")),
      maxDurationSeconds: 8,
    });
    const chapterPath = artifactPath(runId, "production/render/youtube_chapters.json");
    const manifestPath = artifactPath(runId, "production/render/render_manifest.json");
    const chapterJson = JSON.parse(await readFile(chapterPath, "utf8")) as Record<string, unknown>;
    const copiedChapterJson = `${JSON.stringify({ ...chapterJson, runId: "run_other" })}\n`;
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      chapterDraft: { jsonSha256: string };
    };
    manifest.chapterDraft.jsonSha256 = createHash("sha256").update(copiedChapterJson).digest("hex");
    await writeFile(chapterPath, copiedChapterJson, "utf8");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const evidence = (await generateEvidenceBundle(runId)) as {
      draftRender: Extract<DraftRenderEvidence, { status: "block" }>;
    };

    expect(evidence.draftRender).toMatchObject({
      message: expect.stringContaining("chapter JSON run id"),
      status: "block",
    });
  });

  it("blocks draft render completion when media probing cannot validate the output", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    const ffmpeg = await createFakeFfmpeg(renderToolRoot("probe-failure"));
    const ffprobe = await createFailingFakeFfprobe(renderToolRoot("probe-failure"));

    await expect(
      renderDraft(runId, { ffmpegBinary: ffmpeg, ffprobeBinary: ffprobe, maxDurationSeconds: 1 }),
    ).rejects.toThrow(/ffprobe exited/i);

    const run = await loadRun(runId);
    expect(run.state).toBe("RENDER_APPROVED");
    expect(run.artifacts).not.toContain("production/render/draft.mp4");
    expect(await pathExists(artifactPath(runId, "production/render/draft.mp4"))).toBe(false);
  });
});
