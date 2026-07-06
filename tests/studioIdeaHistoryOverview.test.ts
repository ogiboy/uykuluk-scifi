import { describe, expect, it } from "vitest";

import { getStudioIdeaHistoryOverview } from "../apps/studio/src/lib/ideaHistoryOverview";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { useTempProject } from "./helpers";

describe("Studio idea history overview", () => {
  useTempProject();

  it("summarizes generated and approved idea titles from runtime artifacts", async () => {
    const { ideas, runId } = await runIdeas();
    await approveIdea(runId, ideas[0].id);

    const overview = await getStudioIdeaHistoryOverview();
    const approvedEntry = overview.entries.find((entry) => entry.ideaId === ideas[0].id);

    expect(overview).toMatchObject({
      approvedCount: 1,
      duplicateTitleCount: 0,
      generatedOnlyCount: ideas.length - 1,
      policy: {
        hardBlock: "generated-and-approved",
        promptContext: "title-only",
        source: "runtime-ideas-json",
      },
      runCount: 1,
      totalCount: ideas.length,
    });
    expect(approvedEntry).toMatchObject({
      ideaId: ideas[0].id,
      runId,
      status: "approved",
      title: ideas[0].title,
    });
    expect(overview.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ideaId: ideas[1].id,
          status: "generated",
          title: ideas[1].title,
        }),
      ]),
    );
  });
});
