import { describe, expect, it } from "vitest";
import {
  renderEvidenceMarkdown,
  type EvidenceMarkdownBundle,
} from "../src/stages/evidenceMarkdown";

describe("evidence Markdown media summary", () => {
  it("summarizes blocked production media evidence", () => {
    const markdown = renderEvidenceMarkdown({
      ...baseBundle(),
      renderPlan: { status: "block", path: "production/render_plan.json", message: "bad plan" },
      voiceoverAudio: {
        status: "block",
        path: "production/audio/voiceover.wav",
        message: "bad voiceover",
      },
      draftRender: {
        status: "block",
        path: "production/render/draft.mp4",
        message: "bad render",
      },
    });

    expect(markdown).toContain("Render plan: block (bad plan).");
    expect(markdown).toContain("Voiceover audio: block (bad voiceover).");
    expect(markdown).toContain("Draft render: block (bad render).");
    expect(markdown).toContain(
      "Review: Resolve the blocker from the CLI before approving, rendering, uploading, or publishing.",
    );
  });

  it("summarizes draft render evidence with required media probe data", () => {
    const markdown = renderEvidenceMarkdown({
      ...baseBundle(),
      renderPlan: {
        status: "pass",
        path: "production/render_plan.json",
        digest: digest(),
        assetCount: 3,
        artifactCount: 3,
      },
      voiceoverAudio: {
        status: "pass",
        path: "production/audio/voiceover.wav",
        digest: digest(),
        durationSeconds: 2.4,
        mode: "deterministic-local",
        productionVoiceCandidate: false,
        quality: "deterministic-local-reference",
        reviewPath: "production/audio/voiceover_review.md",
        sourceWordCount: 12,
      },
      draftRender: {
        status: "pass",
        path: "production/render/draft.mp4",
        digest: digest(),
        bytes: 123,
        durationSeconds: 3.1,
        overlayRoles: [],
        timelineSegments: ["scene"],
        sourceFrameCount: 0,
        sourceFrameSegments: [],
        sourceFrameCadence: [],
        reviewPath: "production/render/draft_review.md",
        reviewChecklist: ["review locally"],
        ffmpegReviewCommand: "ffmpeg -v error -i production/render/draft.mp4 -f null -",
        voiceoverMode: "deterministic-local",
        voiceoverProductionVoiceCandidate: false,
        voiceoverQuality: "deterministic-local-reference",
        renderApproval: {
          approvalId: "approval_render_trace",
          approvedRef: digest(),
        },
        mediaProbe: {
          binary: "ffprobe",
          durationSeconds: 3.1,
          audio: { codecName: "aac" },
          video: { height: 720, width: 1280 },
        },
      },
    });

    expect(markdown).toContain(
      "Draft render: pass (3s, scene, voiceover deterministic-local timing/reference only, approval approval_render_trace, ffprobe 1280x720 audio).",
    );
    expect(markdown).toContain(
      "Voiceover audio: pass (2s, deterministic-local, timing/reference only, 12 source words).",
    );
    expect(markdown).toContain(
      "Review: Review with pnpm producer review voice --run run_media_summary; use this audio only for local timing review; regenerate reviewed production voice before final render review.",
    );
    expect(markdown).toContain(
      "Review: Review with pnpm producer review render --run run_media_summary; treat this MP4 as a timing draft only; production voice is still required before final review.",
    );
  });

  it("includes production media review actions for missing artifacts", () => {
    const markdown = renderEvidenceMarkdown(baseBundle());

    expect(markdown).toContain(
      "Review: Generate the render plan and contact sheet from the CLI before voiceover or render work.",
    );
    expect(markdown).toContain(
      "Review: Generate and review local voiceover from the CLI before render approval.",
    );
    expect(markdown).toContain(
      "Review: Approve and run the local draft render from the CLI only after current plan and voiceover evidence pass.",
    );
  });

  it("materializes the run id in the operator-facing next command", () => {
    const markdown = renderEvidenceMarkdown({
      ...baseBundle(),
      nextRecommendedCommand: "pnpm producer review voice --run <run_id>",
    });

    expect(markdown).toContain("pnpm producer review voice --run run_media_summary");
    expect(markdown).not.toContain("review voice --run <run_id>");
  });
});

function baseBundle(): EvidenceMarkdownBundle {
  return {
    runId: "run_media_summary",
    generatedAt: "2026-06-25T13:00:00.000Z",
    currentState: "READY_FOR_MANUAL_PRODUCTION",
    approvedIdea: null,
    approvals: [],
    costs: [],
    costReservations: [],
    costQuote: null,
    productionPackageIntegrity: null,
    renderPlan: {
      status: "missing",
      requiredArtifacts: [
        "production/render_plan.json",
        "production/storyboard_contact_sheet.md",
        "production/asset_provenance.json",
      ],
    },
    voiceoverAudio: {
      status: "missing",
      requiredArtifacts: [
        "production/audio/voiceover.wav",
        "production/audio/voiceover.meta.json",
        "production/audio/voiceover_review.md",
      ],
    },
    draftRender: {
      status: "missing",
      requiredArtifacts: [
        "production/render/draft.mp4",
        "production/render/render_manifest.json",
        "production/render/draft_review.md",
      ],
    },
    generatedArtifacts: [],
    warnings: [],
    promptProvenance: [],
    revisions: [],
    blockedActions: [],
    nextRecommendedCommand: "pnpm producer status --run <run_id>",
  };
}

function digest(): string {
  return "a".repeat(64);
}
