import { describe, expect, it } from "vitest";
import { renderRunLinkTemplate } from "../src/analytics/runLinkTemplate";

describe("analytics run link template", () => {
  it("renders fillable CSV rows for unmapped records only", () => {
    const csv = renderRunLinkTemplate([
      { runId: "run_20260624010101_abcd12", title: "Mapped", videoId: "yt_mapped", views: 500 },
      { videoId: "yt_unknown" },
      {
        publishedAt: "2026-06-21T12:00:00.000Z",
        title: 'Low, "quoted"',
        videoId: "yt_low",
        views: 10,
      },
      { title: "High\nViews", videoId: "yt_high", views: 1000 },
    ]);

    expect(csv).toBe(
      [
        "run_id,video_id,title,published_at,views,notes",
        ',yt_high,"High\nViews",,1000,"Fill run_id, then include it in the next analytics import."',
        ',yt_low,"Low, ""quoted""",2026-06-21T12:00:00.000Z,10,"Fill run_id, then include it in the next analytics import."',
        ',yt_unknown,,,,"Fill run_id, then include it in the next analytics import."',
      ].join("\n"),
    );
  });

  it("keeps the template header when no records need a run link", () => {
    expect(
      renderRunLinkTemplate([
        { runId: "run_20260624010101_abcd12", title: "Mapped", videoId: "yt_mapped" },
      ]),
    ).toBe("run_id,video_id,title,published_at,views,notes");
  });
});
