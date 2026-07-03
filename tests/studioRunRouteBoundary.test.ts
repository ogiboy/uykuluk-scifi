import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Studio run route boundaries", () => {
  it("keeps missing run recovery fail-closed and operator-facing", async () => {
    const source = await routeBoundarySource("not-found.tsx");

    expect(source).toContain("Run not found");
    expect(source).toContain("No action taken");
    expect(source).toContain("Missing run files never imply approval");
    expect(source).toContain("upload permission");
    expect(source).toContain("publish permission");
  });

  it("keeps run-detail read failures local and non-mutating", async () => {
    const source = await routeBoundarySource("error.tsx");

    expect(source).toContain("Run review failed safely");
    expect(source).toContain("No action taken");
    expect(source).toContain("did not retry approvals");
    expect(source).toContain("change run state");
    expect(source).toContain("upload media");
    expect(source).toContain("publish content");
  });
});

async function routeBoundarySource(fileName: "error.tsx" | "not-found.tsx"): Promise<string> {
  return readFile(path.join(process.cwd(), "apps/studio/src/app/runs/[runId]", fileName), "utf8");
}
