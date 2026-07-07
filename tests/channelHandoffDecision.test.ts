import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { loadRun } from "../src/core/runStore";
import { createChannelHandoff } from "../src/stages/channelHandoff";
import {
  channelHandoffDecisionJsonPath,
  channelHandoffDecisionMarkdownPath,
  recordChannelHandoffDecision,
  type ChannelHandoffDecisionRecord,
} from "../src/stages/channelHandoffDecision";
import { createFinalReviewBundle } from "../src/stages/finalReviewBundle";
import { recordRenderDecision } from "../src/stages/renderDecision";
import { formatRunStatus, readRunStatus } from "../src/stages/status";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";

const repoRoot = process.cwd();

describe("manual channel handoff decision", () => {
  useTempProject();

  it("records the selected thumbnail and channel-prep decision without upload approval", async () => {
    const runId = await acceptedChannelHandoffRun("channel-decision");

    const result = runCli([
      "decide",
      "channel-handoff",
      "--run",
      runId,
      "--decision",
      "accepted-for-manual-channel-prep",
      "--thumbnail-candidate",
      "thumbnail-01-left",
      "--notes",
      "Metadata, chapters, subtitles, and thumbnail candidate are ready for manual review.",
      "--reviewed-by",
      "operator",
      "--json",
    ]);

    expect(result.status).toBe(0);
    const decision = JSON.parse(result.stdout) as ChannelHandoffDecisionRecord;
    expect(decision).toMatchObject({
      decision: "accepted-for-manual-channel-prep",
      manualOnly: true,
      reviewedBy: "operator",
      runId,
      selectedThumbnailCandidate: {
        candidateId: "thumbnail-01-left",
        templatePath: "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg",
      },
    });
    expect(decision.nextSafeAction).toContain("Private upload remains disabled");

    const run = await loadRun(runId);
    expect(run.artifacts).toEqual(
      expect.arrayContaining([channelHandoffDecisionJsonPath, channelHandoffDecisionMarkdownPath]),
    );
    const markdown = await readFile(
      artifactPath(runId, channelHandoffDecisionMarkdownPath),
      "utf8",
    );
    expect(markdown).toContain("# Manual Channel Handoff Decision");
    expect(markdown).toContain("thumbnail-01-left");
    expect(markdown).toContain("does not call YouTube APIs");
    const ledger = await readLedger(runId);
    expect(ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "decide-channel-handoff",
          type: "REVIEW_DECISION_RECORDED",
        }),
      ]),
    );

    const status = await readRunStatus(runId);
    expect(status.channelHandoffDecision).toMatchObject({
      kind: "present",
      decision: { decision: "accepted-for-manual-channel-prep" },
      reviewPath: channelHandoffDecisionMarkdownPath,
    });
    expect(status.nextRecommendedCommand).toContain("Private upload remains disabled");
    expect(formatRunStatus(status)).toContain(
      "Channel handoff decision: accepted-for-manual-channel-prep by operator",
    );
  });

  it("fails closed before trusted channel handoff evidence exists", async () => {
    const runId = await acceptedFinalReviewRun("channel-decision-missing-handoff");

    await expect(
      recordChannelHandoffDecision({
        decision: "accepted-for-manual-channel-prep",
        notes: "Too early.",
        reviewedBy: "operator",
        runId,
        thumbnailCandidateId: "thumbnail-01-left",
      }),
    ).rejects.toThrow(/trusted channel handoff evidence/i);
    await expect(
      readFile(artifactPath(runId, channelHandoffDecisionJsonPath), "utf8"),
    ).rejects.toThrow();
  });

  it("rejects unknown thumbnail candidates without writing decision artifacts", async () => {
    const runId = await acceptedChannelHandoffRun("channel-decision-bad-thumbnail");

    await expect(
      recordChannelHandoffDecision({
        decision: "accepted-for-manual-channel-prep",
        notes: "Invalid thumbnail selection.",
        reviewedBy: "operator",
        runId,
        thumbnailCandidateId: "thumbnail-missing",
      }),
    ).rejects.toThrow(/unknown thumbnail candidate/i);
    await expect(
      readFile(artifactPath(runId, channelHandoffDecisionJsonPath), "utf8"),
    ).rejects.toThrow();
  });

  it("requires a selected thumbnail for accepted manual channel prep", async () => {
    const runId = await acceptedChannelHandoffRun("channel-decision-missing-thumbnail");

    await expect(
      recordChannelHandoffDecision({
        decision: "accepted-for-manual-channel-prep",
        notes: "Missing selected thumbnail.",
        reviewedBy: "operator",
        runId,
      }),
    ).rejects.toThrow(/thumbnail-candidate/i);
  });

  it("records revision decisions without selecting a thumbnail", async () => {
    const runId = await acceptedChannelHandoffRun("channel-decision-revision");

    const decision = await recordChannelHandoffDecision({
      decision: "needs-revision",
      notes: "Metadata needs another manual pass before channel prep.",
      reviewedBy: "operator",
      runId,
    });

    expect(decision.selectedThumbnailCandidate).toBeNull();
    expect(decision.nextSafeAction).toContain("Revise the channel handoff inputs");
    const markdown = await readFile(
      artifactPath(runId, channelHandoffDecisionMarkdownPath),
      "utf8",
    );
    expect(markdown).toContain("No thumbnail candidate selected for this decision outcome.");
  });

  it("marks manual channel handoff decisions stale when the handoff digest changes", async () => {
    const runId = await acceptedChannelHandoffRun("channel-decision-stale");
    await recordChannelHandoffDecision({
      decision: "accepted-for-manual-channel-prep",
      notes: "Ready before tamper.",
      reviewedBy: "operator",
      runId,
      thumbnailCandidateId: "thumbnail-01-left",
    });
    const handoffPath = artifactPath(runId, "production/channel_handoff.json");
    const handoff = JSON.parse(await readFile(handoffPath, "utf8")) as {
      operatorChecklist: string[];
    };
    await writeFile(
      handoffPath,
      JSON.stringify({
        ...handoff,
        operatorChecklist: [...handoff.operatorChecklist, "Tampered after decision."],
      }),
      "utf8",
    );

    const status = await readRunStatus(runId);

    expect(status.channelHandoffDecision).toMatchObject({
      kind: "stale",
      message: "Channel handoff decision depends on stale channel handoff evidence.",
    });
    expect(status.nextRecommendedCommand).toContain("pnpm producer channel-handoff");
  });

  it("marks malformed manual channel handoff decisions invalid", async () => {
    const runId = await acceptedChannelHandoffRun("channel-decision-invalid");
    await writeFile(artifactPath(runId, channelHandoffDecisionJsonPath), "{", "utf8");

    const status = await readRunStatus(runId);

    expect(status.channelHandoffDecision).toMatchObject({ kind: "invalid" });
    expect(status.nextRecommendedCommand).toContain("pnpm producer decide channel-handoff");
  });
});

async function acceptedChannelHandoffRun(scope: string): Promise<string> {
  const runId = await acceptedFinalReviewRun(scope);
  await createChannelHandoff(runId);
  return runId;
}

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
