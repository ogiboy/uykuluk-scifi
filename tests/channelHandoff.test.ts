import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
    expect(markdown).toContain("production/render/draft.mp4");
    expect(markdown).toContain("production/youtube_metadata.json");
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
