import { describe, expect, it } from "vitest";
import {
  studioMutationResultHref,
  studioMutationResultLinkLabel,
} from "../apps/studio/src/lib/mutations/studioMutationResultNavigation";

describe("Studio mutation result navigation", () => {
  it("opens newly-created idea runs on the guarded decision rail", () => {
    expect(studioMutationResultHref("run_new_ideas", "ideas.run")).toBe(
      "/runs/run_new_ideas?tab=progress#review-decision",
    );
    expect(studioMutationResultLinkLabel("ideas.run")).toBe("Open idea approval rail");
  });

  it("opens media-producing actions on the media review tab", () => {
    expect(studioMutationResultHref("run_media", "voice.run")).toBe("/runs/run_media?tab=media");
    expect(studioMutationResultHref("run_media", "render.run")).toBe("/runs/run_media?tab=media");
    expect(studioMutationResultLinkLabel("render.run")).toBe("Open draft render review");
    expect(studioMutationResultHref("run_media", "render.revise")).toBe(
      "/runs/run_media?tab=media#review-decision",
    );
    expect(studioMutationResultLinkLabel("render.revise")).toBe("Open archived draft recovery");
  });

  it("opens review decisions and manual handoff evidence on the handoff tab", () => {
    expect(studioMutationResultHref("run_decision", "render.decide")).toBe(
      "/runs/run_decision?tab=handoff#review-decision",
    );
    expect(studioMutationResultHref("run_decision", "channel-handoff.run")).toBe(
      "/runs/run_decision?tab=handoff",
    );
    expect(studioMutationResultLinkLabel("render.decide")).toBe("Open handoff review");
  });

  it("uses a safe progress fallback for unknown future actions", () => {
    expect(studioMutationResultHref("run_future", "future.action")).toBe(
      "/runs/run_future?tab=progress",
    );
    expect(studioMutationResultLinkLabel("future.action")).toBe("Open affected run");
  });
});
