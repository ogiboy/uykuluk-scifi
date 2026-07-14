import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runReadiness } from "../src/stages/readiness";
import type { DraftRenderEvidence } from "../src/stages/renderEvidence";

export async function expectDraftRenderEvidence(input: {
  approval: { approvalId: string };
  approvedRef: string;
  draftRenderArtifactPath: string;
  runId: string;
}): Promise<void> {
  const { approval, approvedRef, draftRenderArtifactPath, runId } = input;
  const evidence = (await generateEvidenceBundle(runId)) as {
    draftRender: Extract<DraftRenderEvidence, { status: "pass" }>;
  };
  expect(evidence.draftRender).toMatchObject({
    status: "pass",
    path: "production/render/draft.mp4",
    durationSeconds: 8,
    overlayRoles: expect.arrayContaining(["popup-card", "waveform-overlay"]),
    timelineSegments: ["intro", "scene", "outro"],
    sourceFrameCount: 4,
    sourceFrameSegments: ["intro:2", "outro:2"],
    sourceFrameCadence: [
      "intro#1=1s assets/intro/frames/intro_frame_00.jpg",
      "intro#2=1s assets/intro/frames/intro_frame_01.jpg",
      "outro#1=1.5s assets/outro/frames/outro_frame_00.jpg",
      "outro#2=1.5s assets/outro/frames/outro_frame_01.jpg",
    ],
    reviewPath: "production/render/draft_review.md",
    ffmpegReviewCommand: expect.stringContaining(draftRenderArtifactPath),
    voiceoverMode: "deterministic-local",
    voiceoverProductionVoiceCandidate: false,
    voiceoverQuality: "deterministic-local-reference",
    subtitlePath: "production/subtitles.srt",
    subtitleTimingMode: "linear-fallback",
    renderApproval: { approvalId: approval.approvalId, approvedRef },
    mediaProbe: { audio: { codecName: "aac" }, video: { height: 720, width: 1280 } },
  });
  const evidenceMarkdown = await readFile(artifactPath(runId, "evidence_bundle.md"), "utf8");
  expect(evidenceMarkdown).toContain("## Production Media Summary");
  expect(evidenceMarkdown).toContain("Render plan: pass");
  expect(evidenceMarkdown).toContain("Voiceover audio: pass");
  expect(evidenceMarkdown).toContain(
    `Draft render: pass (8s, intro -> scene -> outro, source frames intro:2/outro:2, frame cadence intro#1=1s assets/intro/frames/intro_frame_00.jpg; intro#2=1s assets/intro/frames/intro_frame_01.jpg; outro#1=1.5s assets/outro/frames/outro_frame_00.jpg; outro#2=1.5s assets/outro/frames/outro_frame_01.jpg, voiceover deterministic-local timing/reference only, approval ${approval.approvalId}, ffprobe 1280x720 audio)`,
  );
  const review = await readFile(artifactPath(runId, "production/render/draft_review.md"), "utf8");
  expect(review).toContain("# Draft Render Review");
  expect(review).toContain("## FFmpeg Review Command");
  expect(review).toContain(draftRenderArtifactPath);
  expect(review).toContain("atomic temporary output");
  expect(review).toContain("## Media Probe");
  expect(review).toContain("## Timing Alignment");
  expect(review).toContain("Subtitle clock scale");
  expect(review).toContain(`pnpm producer revise render --run ${runId}`);
  expect(review).toContain("## Render Approval");
  expect(review).toContain("## Timestamped Review Map");
  expect(review).toContain("## YouTube Chapter Draft");
  expect(review).toContain("production/render/youtube_chapters.md");
  expect(review).toContain("| 0:00.00-0:01.00 | intro | source frame 1 |");
  expect(review).toContain("| intro | - | 1 | 1s | assets/intro/frames/intro_frame_00.jpg |");
  expect(review).toContain("| outro | - | 2 | 1.5s | assets/outro/frames/outro_frame_01.jpg |");
  expect(review).toContain(approval.approvalId);
  expect(review).toContain(approvedRef);
  expect(review).toContain("1280x720 h264");
  expect(review).toContain("Local review artifact only");
  expect(review).toContain("timing/reference only; local timing draft");
  expect(review).toContain("not final production voice");
  expect(review).toContain("assets/intro/episode_title_card_1920x1080.jpg");
  expect(review).toContain("assets/outro/youtube_end_screen_1920x1080.jpg");
  expect(review).toContain("## Operator Decision");
  expect(review).toContain(`Keep the local draft with run ${runId} for manual review`);
  expect(review).toContain("Upload remains disabled");
  expect(review).toContain("Scheduled/public publish remains disabled");
  const readiness = await runReadiness(runId);
  expect(readiness.checks.find((check) => check.name === "draft render available")).toMatchObject({
    message: expect.stringContaining(
      `ffprobe-validated draft video (1280x720, audio stream present, source frames intro:2/outro:2, voiceover deterministic-local timing/reference only, approval ${approval.approvalId})`,
    ),
    status: "pass",
  });
}
