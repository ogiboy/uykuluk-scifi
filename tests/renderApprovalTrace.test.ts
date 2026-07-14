import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import { approveRender } from "../src/stages/approveRender";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { renderDraft } from "../src/stages/render";
import type { DraftRenderEvidence } from "../src/stages/renderEvidence";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import { prepareVoiceoverReadyRun } from "./renderPipelineHelpers";
import { createFakeFfmpeg, createFakeFfprobe, renderToolRoot } from "./renderTestHelpers";

describe("draft render approval trace", () => {
  useTempProject();

  it("rejects stale render approval after voiceover classification changes", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    const metaPath = artifactPath(runId, "production/audio/voiceover.meta.json");
    const meta = await readJsonFile<Record<string, unknown>>(metaPath);
    await writeFile(metaPath, `${JSON.stringify({ ...meta, quality: "local-piper" }, null, 2)}\n`);

    await expect(renderDraft(runId, { ffprobeBinary: false })).rejects.toThrow(/stale/i);

    const run = await loadRun(runId);
    expect(run.state).toBe("RENDER_APPROVED");
    expect(run.artifacts).not.toContain("production/render/draft.mp4");
    expect(await pathExists(artifactPath(runId, "production/render/draft.mp4"))).toBe(false);
  });

  it("rejects stale render approval after active subtitle metadata changes", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    const subtitleMetadataPath = artifactPath(
      runId,
      "production/audio/subtitles.aligned.meta.json",
    );
    const subtitleMetadata = await readJsonFile<Record<string, unknown>>(subtitleMetadataPath);
    const revisedSubtitleMetadataText = `${JSON.stringify(
      { ...subtitleMetadata, createdAt: "2026-07-13T00:00:00.000Z" },
      null,
      2,
    )}\n`;
    await writeFile(subtitleMetadataPath, revisedSubtitleMetadataText, "utf8");

    const voiceMetadataPath = artifactPath(runId, "production/audio/voiceover.meta.json");
    const voiceMetadata = await readJsonFile<
      { subtitle: { metadataSha256: string } } & Record<string, unknown>
    >(voiceMetadataPath);
    await writeFile(
      voiceMetadataPath,
      `${JSON.stringify(
        {
          ...voiceMetadata,
          subtitle: {
            ...voiceMetadata.subtitle,
            metadataSha256: createHash("sha256")
              .update(revisedSubtitleMetadataText, "utf8")
              .digest("hex"),
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await expect(renderDraft(runId, { ffprobeBinary: false })).rejects.toThrow(/stale/i);
    expect(await readFile(voiceMetadataPath, "utf8")).toContain("subtitles.aligned");
  });

  it("blocks draft render evidence when the render approval record changes", async () => {
    const runId = await prepareVoiceoverReadyRun();
    const approval = await approveRender(runId);
    const ffmpeg = await createFakeFfmpeg(renderToolRoot("approval-change"));
    const ffprobe = await createFakeFfprobe(renderToolRoot("approval-change"));
    await renderDraft(runId, {
      ffmpegBinary: ffmpeg,
      ffprobeBinary: ffprobe,
      maxDurationSeconds: 1,
    });

    const run = await loadRun(runId);
    await saveRun({
      ...run,
      approvals: run.approvals.map((item) =>
        item.approvalId === approval.approvalId
          ? { ...item, approvalId: "approval_replaced_after_render" }
          : item,
      ),
    });

    const evidence = (await generateEvidenceBundle(runId)) as {
      draftRender: Extract<DraftRenderEvidence, { status: "block" }>;
    };

    expect(evidence.draftRender).toMatchObject({
      status: "block",
      path: "production/render/draft.mp4",
      message: "Draft render approval record changed after render.",
    });
  });
});
