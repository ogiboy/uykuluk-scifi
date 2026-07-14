import { describe, expect, it } from "vitest";
import { encodeVisualImportFile } from "../apps/studio/src/components/runs/visual-review/visualImportFile";

describe("Studio visual review component behavior", () => {
  it("reports an import interaction failure when browser file encoding rejects", async () => {
    const setFileError = vi.fn();
    const reportError = vi.fn();
    const file = new File(["image"], "scene.png", { type: "image/png" });

    await expect(
      encodeVisualImportFile(
        file,
        { actionId: "visuals.import", routePath: "/actions/visuals-import" },
        setFileError,
        reportError,
        async () => {
          throw new Error("Visual file could not be read.");
        },
      ),
    ).resolves.toBeNull();
    expect(setFileError).toHaveBeenCalledWith("Visual file could not be read.");
    expect(reportError).toHaveBeenCalledWith({
      actionId: "visuals.import",
      message: "Visual file could not be read.",
      routePath: "/actions/visuals-import",
      toastTitle: "Visual import blocked",
    });
  });
});
