import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { reviseRender } from "../src/revisions/renderRevision";
import { approveRender } from "../src/stages/approveRender";
import { renderDraft } from "../src/stages/render";
import { recordRenderDecision } from "../src/stages/renderDecision";
import type { DraftRenderManifest } from "../src/stages/renderEvidence";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";
import { createFakeFfmpeg, createFakeFfprobe, renderToolRoot } from "./renderTestHelpers";

describe("render revision recovery", () => {
  useTempProject();

  it("archives a non-accepted draft and requires a fresh approval before rerendering", async () => {
    const runId = await renderLocalDraft("render-revision");
    const originalRun = await loadRun(runId);
    const originalApproval = originalRun.approvals.find((item) => item.target === "render");
    const decision = await recordRenderDecision({
      decision: "needs-revision",
      notes: "The timing draft needs a corrected intro and subtitle offset.",
      reviewedBy: "operator",
      runId,
    });

    const revision = await reviseRender(runId);

    const revisedRun = await loadRun(runId);
    expect(revision).toMatchObject({
      decision: "needs-revision",
      invalidatedApprovalIds: [originalApproval?.approvalId],
      nextState: "READY_FOR_MANUAL_PRODUCTION",
      previousState: "RENDERED",
      runId,
      schemaVersion: 1,
    });
    expect(revisedRun.state).toBe("READY_FOR_MANUAL_PRODUCTION");
    expect(revisedRun.approvals.some((item) => item.target === "render")).toBe(false);
    expect(revisedRun.artifacts).not.toContain("production/render/draft.mp4");
    expect(revisedRun.artifacts).not.toContain("production/render/render_decision.json");
    expect(revisedRun.artifacts).not.toContain("evidence_bundle.json");
    await expect(pathExists(artifactPath(runId, "production/render/draft.mp4"))).resolves.toBe(
      false,
    );

    const archivedDraft = revision.archivedArtifacts.find(
      (item) => item.sourcePath === "production/render/draft.mp4",
    );
    expect(archivedDraft).toBeDefined();
    const archivedBytes = await readFile(artifactPath(runId, archivedDraft?.archivedPath ?? ""));
    expect(createHash("sha256").update(archivedBytes).digest("hex")).toBe(
      decision.draftRender.sha256,
    );
    expect(revision.archivedArtifacts.map((item) => item.sourcePath)).toEqual(
      expect.arrayContaining([
        "production/render/render_manifest.json",
        "production/render/render_decision.json",
        "diagnostics/readiness.json",
      ]),
    );

    const freshApproval = await approveRender(runId);
    expect(freshApproval.approvalId).not.toBe(originalApproval?.approvalId);
    const manifest = await renderDraft(runId, {
      ffmpegBinary: await createFakeFfmpeg(renderToolRoot("render-revision-rerender")),
      ffprobeBinary: await createFakeFfprobe(renderToolRoot("render-revision-rerender")),
      maxDurationSeconds: 8,
    });
    const rerenderedManifest = manifest as DraftRenderManifest;
    expect(rerenderedManifest.schemaVersion).toBe(11);
    expect(rerenderedManifest.voiceoverAudio.metadataDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(rerenderedManifest.subtitles).toMatchObject({
      timingMode: "linear-fallback",
      path: "production/subtitles.srt",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      metadataPath: "production/audio/subtitles.aligned.meta.json",
      metadataSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(rerenderedManifest.subtitleTiming).toEqual({
      timingMode: rerenderedManifest.subtitles.timingMode,
      sourceDurationSeconds: rerenderedManifest.subtitles.sourceDurationSeconds,
      sceneDurationSeconds: expect.any(Number),
      timeScale: expect.any(Number),
    });
    expect(rerenderedManifest.renderApproval).toEqual({
      approvalId: freshApproval.approvalId,
      approvedRef: freshApproval.approvedRef,
      contractVersion: 4,
    });
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "RENDERED" });
    await expect(
      recordRenderDecision({
        decision: "accepted-for-local-review",
        notes: "The corrected local draft is ready for final review.",
        reviewedBy: "operator",
        runId,
      }),
    ).resolves.toMatchObject({ decision: "accepted-for-local-review" });
  });

  it("refuses to invalidate a draft that the operator accepted", async () => {
    const runId = await renderLocalDraft("accepted-render-revision");
    await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "The draft is accepted for local review.",
      reviewedBy: "operator",
      runId,
    });

    await expect(reviseRender(runId)).rejects.toThrow(/accepted render decision/i);
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "RENDERED" });
    await expect(pathExists(artifactPath(runId, "production/render/draft.mp4"))).resolves.toBe(
      true,
    );
  });

  it("requires explicit attribution to recover a digest-bound draft with invalid evidence", async () => {
    const runId = await renderLocalDraft("invalid-evidence-render-revision");
    const manifestPath = artifactPath(runId, "production/render/render_manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    delete manifest.subtitleTiming;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(reviseRender(runId)).rejects.toThrow(/requires --reason and --reviewed-by/i);
    await expect(
      reviseRender(runId, {
        reason: "The persisted manifest predates the current subtitle timing contract.",
        reviewedBy: "operator",
      }),
    ).resolves.toMatchObject({
      decision: "invalid-evidence",
      decisionReviewedBy: "operator",
      reason: "The persisted manifest predates the current subtitle timing contract.",
    });
    await expect(loadRun(runId)).resolves.toMatchObject({
      approvals: expect.not.arrayContaining([expect.objectContaining({ target: "render" })]),
      state: "READY_FOR_MANUAL_PRODUCTION",
    });
  });
});
