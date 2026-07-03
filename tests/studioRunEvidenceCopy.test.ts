import { describe, expect, it } from "vitest";
import {
  artifactPreviewsIntro,
  blockedActionsEmptyMessage,
  blockedActionsIntro,
  productionMediaIntro,
  productionMediaReviewAction,
  productionMediaReviewSummary,
  shouldShowEvidenceRemediation,
} from "../apps/studio/src/lib/runEvidenceCopy";
import type { ProductionMediaStatus } from "../src/stages/statusMediaSummary";

describe("Studio run evidence copy", () => {
  it("allows no-blocker copy only when evidence is current", () => {
    expect(blockedActionsIntro("available")).toContain("current CLI/core safeguard bundle");
    expect(blockedActionsEmptyMessage("available")).toBe(
      "No blocked actions recorded in the latest evidence bundle.",
    );
    expect(shouldShowEvidenceRemediation("available")).toBe(false);
  });

  it("does not treat unavailable evidence as proof that actions are unblocked", () => {
    expect(blockedActionsIntro("stale")).toContain("does not infer that actions are unblocked");
    expect(blockedActionsEmptyMessage("stale")).toBe(
      "Regenerate evidence before treating blocked-action status as review proof.",
    );
    expect(shouldShowEvidenceRemediation("missing")).toBe(true);
    expect(shouldShowEvidenceRemediation("invalid")).toBe(true);
  });

  it("labels production-media fallback as artifact-record evidence until evidence is current", () => {
    expect(productionMediaIntro("available")).toContain("current CLI evidence bundle");
    expect(productionMediaIntro("stale")).toContain("fallback from persisted artifact records");
  });

  it("gives conservative production-media review actions", () => {
    expect(
      productionMediaReviewAction("available", {
        artifactPath: "production/render_plan.json",
        evidenceKey: "renderPlan",
        label: "Render plan",
        reviewCommand: "pnpm producer review render-plan --run run_studio_copy",
        status: "pass",
      }),
    ).toBe(
      "Review with pnpm producer review render-plan --run run_studio_copy; confirm scene-to-asset mapping, bookend/source-frame paths, and the contact sheet before voiceover or render approval.",
    );
    expect(
      productionMediaReviewAction("available", {
        artifactPath: "production/audio/voiceover.wav",
        detail: "8s, deterministic-local, timing/reference only",
        evidenceKey: "voiceoverAudio",
        label: "Voiceover audio",
        localPlaybackPath: "runs/run_studio_copy/production/audio/voiceover.wav",
        reviewCommand: "pnpm producer review voice --run run_studio_copy",
        status: "pass",
      }),
    ).toBe(
      "Review with pnpm producer review voice --run run_studio_copy; listen to runs/run_studio_copy/production/audio/voiceover.wav; use this audio only for local timing review; regenerate reviewed production voice before final render review.",
    );
    expect(
      productionMediaReviewAction("available", {
        artifactPath: "production/audio/voiceover.wav",
        detail: "8s, local-piper, production voice candidate",
        evidenceKey: "voiceoverAudio",
        label: "Voiceover audio",
        localPlaybackPath: "runs/run_studio_copy/production/audio/voiceover.wav",
        reviewCommand: "pnpm producer review voice --run run_studio_copy",
        status: "pass",
      }),
    ).toBe(
      "Review with pnpm producer review voice --run run_studio_copy; listen to runs/run_studio_copy/production/audio/voiceover.wav and verify pronunciation, pacing, and tone before render approval.",
    );
    expect(
      productionMediaReviewAction("available", {
        artifactPath: "production/render/draft.mp4",
        detail: "8s, voiceover local-piper production candidate",
        evidenceKey: "draftRender",
        label: "Draft render",
        reviewCommand: "pnpm producer review render --run run_studio_copy",
        status: "pass",
      }),
    ).toBe(
      "Review with pnpm producer review render --run run_studio_copy; upload and publish remain disabled.",
    );
    expect(
      productionMediaReviewAction("stale", {
        artifactPath: "production/render/draft.mp4",
        evidenceKey: "draftRender",
        label: "Draft render",
        status: "recorded",
      }),
    ).toBe("Regenerate evidence before using this media row as current review proof.");
  });

  it("keeps artifact previews separate from current review proof", () => {
    expect(artifactPreviewsIntro("available")).toContain("current evidence bundle");
    expect(artifactPreviewsIntro("invalid")).toContain("local artifact records only");
    expect(artifactPreviewsIntro("invalid")).toContain("Regenerate evidence");
  });

  it("summarizes media review state without treating stale evidence as verified", () => {
    const media: ProductionMediaStatus[] = [
      mediaStatus("renderPlan", "Render plan", "production/render_plan.json", "pass"),
      mediaStatus("voiceoverAudio", "Voiceover audio", "production/audio/voiceover.wav", "pass"),
      mediaStatus("draftRender", "Draft render", "production/render/draft.mp4", "missing"),
    ];

    expect(productionMediaReviewSummary("available", media)).toMatchObject({
      blockedCount: 0,
      missingCount: 1,
      recordedOnlyCount: 0,
      title: "Media artifacts still pending",
      tone: "pending",
      totalCount: 3,
      verifiedCount: 2,
    });
    expect(productionMediaReviewSummary("stale", media)).toMatchObject({
      title: "Refresh evidence before trusting media",
      tone: "attention",
      verifiedCount: 0,
    });
  });

  it("prioritizes blocked media before missing or reviewable rows", () => {
    const summary = productionMediaReviewSummary("available", [
      mediaStatus("renderPlan", "Render plan", "production/render_plan.json", "pass"),
      mediaStatus("voiceoverAudio", "Voiceover audio", "production/audio/voiceover.wav", "missing"),
      mediaStatus("draftRender", "Draft render", "production/render/draft.mp4", "block"),
    ]);

    expect(summary).toMatchObject({
      blockedCount: 1,
      focus: {
        label: "Draft render",
        status: "block",
      },
      title: "Media review blocked",
      tone: "blocked",
    });
    expect(summary.focus?.action).toContain("Resolve the blocker");
  });

  it("focuses completed media review on the draft render", () => {
    const summary = productionMediaReviewSummary("available", [
      mediaStatus("renderPlan", "Render plan", "production/render_plan.json", "pass"),
      mediaStatus("voiceoverAudio", "Voiceover audio", "production/audio/voiceover.wav", "pass"),
      mediaStatus("draftRender", "Draft render", "production/render/draft.mp4", "pass"),
    ]);

    expect(summary).toMatchObject({
      focus: {
        label: "Draft render",
        status: "pass",
      },
      title: "Local media ready for review",
      tone: "ready",
      verifiedCount: 3,
    });
  });
});

function mediaStatus(
  evidenceKey: ProductionMediaStatus["evidenceKey"],
  label: string,
  artifactPath: string,
  status: ProductionMediaStatus["status"],
): ProductionMediaStatus {
  return {
    artifactPath,
    evidenceKey,
    label,
    status,
  };
}
