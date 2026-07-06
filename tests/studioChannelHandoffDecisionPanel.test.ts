import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe("RunChannelHandoffDecisionPanel", () => {
  it("renders present manual channel handoff decisions as read-only local evidence", async () => {
    const { RunChannelHandoffDecisionPanel } = await loadChannelHandoffDecisionPanel();

    const element = RunChannelHandoffDecisionPanel({
      channelHandoffDecision: {
        decision: {
          blockedActions: ["This decision does not call YouTube APIs."],
          channelHandoff: {
            digest: "a".repeat(64),
            path: "production/channel_handoff.json",
            status: "ready-for-manual-channel-review",
          },
          createdAt: "2026-06-28T00:00:00.000Z",
          decision: "accepted-for-manual-channel-prep",
          manualOnly: true,
          nextSafeAction: "Private upload remains disabled.",
          notes: "Reviewed.",
          reviewedBy: "operator",
          runId: "run_202606280001_channel",
          schemaVersion: 1,
          selectedThumbnailCandidate: {
            candidateId: "thumbnail-01-left",
            templatePath: "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg",
            templateSha256: "b".repeat(64),
          },
          youtube: {
            metadataPath: "production/youtube_metadata.json",
            title: "Fixture title",
          },
        },
        kind: "present",
        message: "Channel handoff decision recorded: accepted-for-manual-channel-prep.",
        nextAction: "Private upload remains disabled.",
        reviewPath: "production/channel_handoff_decision.md",
      },
    });

    const text = flattenReactText(element);

    expect(text).toContain("Manual Channel Handoff Decision");
    expect(text).toContain("accepted-for-manual-channel-prep");
    expect(text).toContain("operator");
    expect(text).toContain("thumbnail-01-left");
    expect(text).toContain("production/channel_handoff_decision.md");
    expect(text).toContain("This decision does not upload, schedule, publish, or approve upload.");
  });

  it("renders missing manual channel handoff decisions with the remediation command", async () => {
    const { RunChannelHandoffDecisionPanel } = await loadChannelHandoffDecisionPanel();

    const element = RunChannelHandoffDecisionPanel({
      channelHandoffDecision: {
        kind: "missing",
        message: "Manual channel-handoff decision has not been recorded.",
        nextAction:
          "pnpm producer decide channel-handoff --run run_202606280001_channel --decision accepted-for-manual-channel-prep --thumbnail-candidate <candidate_id> --notes '<operator notes>' --reviewed-by operator",
      },
    });

    const text = flattenReactText(element);

    expect(text).toContain("missing");
    expect(text).toContain("Manual channel-handoff decision has not been recorded.");
    expect(text).toContain("pnpm producer decide channel-handoff");
    expect(text).not.toContain("Decision artifact");
  });
});

async function loadChannelHandoffDecisionPanel(): Promise<{
  RunChannelHandoffDecisionPanel: (props: { channelHandoffDecision: unknown }) => unknown;
}> {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps/studio/src/components/runs/RunChannelHandoffDecisionPanel.tsx"),
  ).href;
  return (await import(target)) as {
    RunChannelHandoffDecisionPanel: (props: { channelHandoffDecision: unknown }) => unknown;
  };
}

function flattenReactText(value: unknown): string {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(flattenReactText).join(" ");
  }
  if (typeof value === "object" && "props" in value) {
    const props = (value as { props?: { children?: unknown } }).props;
    return [
      flattenReactText(propText(props, "title")),
      flattenReactText(propText(props, "description")),
      flattenReactText(propText(props, "items")),
      flattenReactText(props?.children),
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (typeof value === "object" && "label" in value && "value" in value) {
    const item = value as { label: unknown; value: unknown };
    return [flattenReactText(item.label), flattenReactText(item.value)].filter(Boolean).join(" ");
  }
  return "";
}

function propText(props: { [key: string]: unknown } | undefined, key: string): unknown {
  return props?.[key];
}
