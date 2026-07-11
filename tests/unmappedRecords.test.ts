import { describe, expect, it } from "vitest";
import { unmappedRecordRows } from "../src/analytics/unmappedRecords";

describe("unmapped analytics record rows", () => {
  it("lists only unmapped records by view count with safe table cells", () => {
    const rows = unmappedRecordRows([
      { runId: "run_20260624010101_abcd12", title: "Mapped", videoId: "yt_mapped", views: 500 },
      { publishedAt: "2026-06-20T12:00:00.000Z", videoId: "yt_unknown" },
      { publishedAt: "2026-06-21T12:00:00.000Z", title: "Low|Views", videoId: "yt_low", views: 10 },
      { title: "High\nViews\rEpisode", videoId: "yt_high", views: 1000 },
    ]);

    expect(rows).toEqual([
      ["yt_high", "High Views Episode", "1,000", "unknown", "Add run_id in the next import."],
      ["yt_low", "Low/Views", "10", "2026-06-21T12:00:00.000Z", "Add run_id in the next import."],
      [
        "yt_unknown",
        "unknown",
        "unknown",
        "2026-06-20T12:00:00.000Z",
        "Add run_id in the next import.",
      ],
    ]);
  });

  it("returns an all-clear row when every record is linked to a run", () => {
    expect(
      unmappedRecordRows([
        { runId: "run_20260624010101_abcd12", title: "Mapped", videoId: "yt_mapped" },
      ]),
    ).toEqual([
      ["none", "All imported records include run_id.", "0", "unknown", "No action needed"],
    ]);
  });
});
