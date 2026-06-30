import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { useTempProject } from "./helpers";
import { prepareReadyRunWithoutVoiceover } from "./renderPipelineHelpers";

describe("render plan contact sheet", () => {
  useTempProject();

  it("includes operator timing, rhythm, and approval-boundary guidance", async () => {
    const runId = await prepareReadyRunWithoutVoiceover();

    const contactSheet = await readFile(
      artifactPath(runId, "production/storyboard_contact_sheet.md"),
      "utf8",
    );

    expect(contactSheet).toContain("## Intro And Outro Bookends");
    expect(contactSheet).toContain("## Timing Summary");
    expect(contactSheet).toContain("## Visual Rhythm Review");
    expect(contactSheet).toContain("Scene count:");
    expect(contactSheet).toContain("Intro/outro bookends: 5s");
    expect(contactSheet).toContain("Estimated local draft duration:");
    expect(contactSheet).toContain("Scene duration range:");
    expect(contactSheet).toContain("Average scene duration:");
    expect(contactSheet).toContain("Background reuse:");
    expect(contactSheet).toContain("Asset role counts:");
    expect(contactSheet).toContain("Review checklist:");
    expect(contactSheet).toContain("Revision guidance:");
    expect(contactSheet).toContain("Confirm subtitle panel, popup card, waveform, and watermark");
    expect(contactSheet).toContain("assets/intro/episode_title_card_1920x1080.jpg");
    expect(contactSheet).toContain("Intro source frames: 2 committed frames");
    expect(contactSheet).toContain("assets/outro/youtube_end_screen_1920x1080.jpg");
    expect(contactSheet).toContain("Outro source frames: 2 committed frames");
    expect(contactSheet).toContain("## Operator Decision");
    expect(contactSheet).toContain(`pnpm producer readiness --run ${runId}`);
    expect(contactSheet).toContain(`pnpm producer voice --run ${runId}`);
    expect(contactSheet).toContain(
      "file existence does not approve TTS, render, upload, or publish",
    );
    expect(contactSheet).toContain("public publish");
  });
});
