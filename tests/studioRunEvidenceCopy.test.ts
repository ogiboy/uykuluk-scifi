import { describe, expect, it } from "vitest";
import {
  artifactPreviewsIntro,
  blockedActionsEmptyMessage,
  blockedActionsIntro,
  productionMediaIntro,
  productionMediaReviewAction,
  shouldShowEvidenceRemediation,
} from "../apps/studio/src/lib/runEvidenceCopy";

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
        status: "pass",
      }),
    ).toContain("contact sheet");
    expect(
      productionMediaReviewAction("available", {
        artifactPath: "production/audio/voiceover.wav",
        detail: "8s, deterministic-local, timing/reference only",
        evidenceKey: "voiceoverAudio",
        label: "Voiceover audio",
        reviewCommand: "pnpm producer review voice --run run_studio_copy",
        status: "pass",
      }),
    ).toBe(
      "Review with pnpm producer review voice --run run_studio_copy; use this audio only for local timing review; regenerate reviewed production voice before final render review.",
    );
    expect(
      productionMediaReviewAction("available", {
        artifactPath: "production/audio/voiceover.wav",
        detail: "8s, local-piper, production voice candidate",
        evidenceKey: "voiceoverAudio",
        label: "Voiceover audio",
        reviewCommand: "pnpm producer review voice --run run_studio_copy",
        status: "pass",
      }),
    ).toBe(
      "Review with pnpm producer review voice --run run_studio_copy; listen locally and verify pronunciation, pacing, and tone before render approval.",
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
});
