import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOperatorDeskViewModel, formatOperatorDeskPlain } from "../src/cli/operatorDeskModel";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import {
  channelHandoffJsonPath,
  channelHandoffMarkdownPath,
  createChannelHandoff,
  type ChannelHandoff,
} from "../src/stages/channelHandoff";
import { createFinalReviewBundle } from "../src/stages/finalReviewBundle";
import { recordRenderDecision } from "../src/stages/renderDecision";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";

const repoRoot = process.cwd();

describe("manual channel handoff", () => {
  useTempProject();

  it("creates a manual-only channel handoff after accepted final review", async () => {
    const runId = await acceptedFinalReviewRun("channel-handoff-accepted");

    const handoff = await createChannelHandoff(runId);

    expect(handoff).toMatchObject({
      runId,
      schemaVersion: 1,
      status: "ready-for-manual-channel-review",
      manualOnly: true,
      finalReviewBundle: {
        path: "production/review_bundle.json",
        markdownPath: "production/review_bundle.md",
        status: "accepted-for-local-review",
      },
      media: {
        draftRenderPath: "production/render/draft.mp4",
        subtitlesPath: "production/subtitles.srt",
      },
      youtube: {
        metadataPath: "production/youtube_metadata.json",
      },
    });
    expect(handoff.youtube.title).toContain("UykulukSciFi");
    expect(handoff.operatorChecklist.join(" ")).toContain("Watch the draft MP4");
    expect(handoff.blockedActions.join(" ").toLowerCase()).toContain("does not call youtube");

    const run = await loadRun(runId);
    expect(run.artifacts).toEqual(
      expect.arrayContaining([channelHandoffJsonPath, channelHandoffMarkdownPath]),
    );
    const markdown = await readFile(artifactPath(runId, channelHandoffMarkdownPath), "utf8");
    expect(markdown).toContain("# Manual Channel Handoff");
    expect(markdown).toContain("Local preparation artifact only");
    expect(markdown).toContain("## Manual Upload Preparation");
    expect(markdown).toContain("```text");
    expect(markdown).toContain("production/render/draft.mp4");
    expect(markdown).toContain("production/subtitles.srt");
    expect(markdown).toContain("production/youtube_metadata.json");
    expect(markdown).toContain("## Thumbnail Preparation");
    expect(markdown).toContain("assets/thumbnails/");
    expect(markdown.toLowerCase()).toContain("does not upload");
  });

  it("rejects final-review bundles without an accepted render decision", async () => {
    const runId = await renderLocalDraft("channel-handoff-pending");
    await createFinalReviewBundle(runId);

    await expect(createChannelHandoff(runId)).rejects.toThrow(/accepted local final review/i);
  });

  it("prints parseable CLI JSON and persists the package artifacts", async () => {
    const runId = await acceptedFinalReviewRun("channel-handoff-cli");

    const result = runCli(["channel-handoff", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    const handoff = JSON.parse(result.stdout) as ChannelHandoff;
    expect(handoff).toMatchObject({
      runId,
      status: "ready-for-manual-channel-review",
      manualOnly: true,
    });
    await expect(readFile(artifactPath(runId, channelHandoffJsonPath), "utf8")).resolves.toContain(
      '"ready-for-manual-channel-review"',
    );
  });

  it("prints a copy-ready non-JSON CLI handoff summary", async () => {
    const runId = await acceptedFinalReviewRun("channel-handoff-cli-summary");

    const result = runCli(["channel-handoff", "--run", runId]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Package: production/channel_handoff.md");
    expect(result.stdout).toContain("Subtitles: production/subtitles.srt");
    expect(result.stdout).toContain("Metadata: production/youtube_metadata.json");
    expect(result.stdout).toContain("Title: ");
    expect(result.stdout).toContain("Upload and publish remain disabled.");
  });

  it("surfaces completed manual handoff in status and operator desk output", async () => {
    const runId = await acceptedFinalReviewRun("channel-handoff-status");
    await createChannelHandoff(runId);

    const status = await readRunStatus(runId);
    const statusOutput = formatRunStatus(status);
    const deskOutput = formatOperatorDeskPlain(await buildOperatorDeskViewModel({ runId }));

    expect(status.channelHandoff).toMatchObject({
      kind: "present",
      handoff: { status: "ready-for-manual-channel-review" },
      reviewPath: "production/channel_handoff.md",
    });
    expect(status.nextRecommendedCommand).toContain(
      "Manually review production/channel_handoff.md",
    );
    expect(status.nextRecommendedCommand).not.toContain("producer channel-handoff");
    expect(statusOutput).toContain("Manual channel handoff: ready-for-manual-channel-review");
    expect(statusOutput).toContain(
      "Manual channel handoff artifact: production/channel_handoff.md",
    );
    expect(deskOutput).toContain("Manual channel handoff: ready-for-manual-channel-review");
    expect(deskOutput).toContain("Manual channel handoff artifact: production/channel_handoff.md");
  });
});

async function acceptedFinalReviewRun(scope: string): Promise<string> {
  const runId = await renderLocalDraft(scope);
  await recordRenderDecision({
    decision: "accepted-for-local-review",
    notes: "Draft is acceptable for local channel review.",
    reviewedBy: "operator",
    runId,
  });
  await createFinalReviewBundle(runId);
  return runId;
}

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    [path.join(repoRoot, "src", "cli.ts"), ...args],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  return {
    status: result.status,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}
