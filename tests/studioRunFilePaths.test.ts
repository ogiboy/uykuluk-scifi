import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readReviewArtifactPreviews } from "../apps/studio/src/lib/artifactPreviews";
import { studioRunFilePath } from "../apps/studio/src/lib/runFilePaths";
import { useTempProject } from "./helpers";

describe("Studio run file paths", () => {
  useTempProject();

  it("resolves only validated run IDs and artifact-relative paths", () => {
    expect(studioRunFilePath(process.cwd(), "../outside", "state.json")).toBeNull();
    expect(studioRunFilePath(process.cwd(), "run_202606280001_ok", "../state.json")).toBeNull();
    expect(studioRunFilePath(process.cwd(), "run_202606280001_ok", "state.json")).toBe(
      path.join(process.cwd(), "runs", "run_202606280001_ok", "state.json"),
    );
  });

  it("does not read artifact previews through traversal-shaped run IDs", async () => {
    await mkdir("outside", { recursive: true });
    await writeFile("outside/script.md", "outside script must not be previewed\n", "utf8");

    const previews = await readReviewArtifactPreviews(process.cwd(), "../outside");

    expect(previews.find((preview) => preview.path === "script.md")).toMatchObject({
      exists: false,
      preview: null,
      path: "script.md",
    });
  });
});
