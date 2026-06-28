import { writeFile } from "node:fs/promises";
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
