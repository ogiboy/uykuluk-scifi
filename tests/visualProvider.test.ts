import { describe, expect, it } from "vitest";
import { StaticVisualProvider } from "../src/stages/visuals/visualProvider";

describe("static visual provider", () => {
  it("cycles source assets deterministically by scene and revision", async () => {
    const assets = [
      { role: "background", path: "assets/backgrounds/a.jpg", digest: "a".repeat(64) },
      { role: "background", path: "assets/backgrounds/b.jpg", digest: "b".repeat(64) },
    ];
    const provider = new StaticVisualProvider(assets);
    const input = { runId: "run_test", sceneIndex: 1, visualPrompt: "prompt" };

    await expect(provider.createSceneVisual({ ...input, revision: 1 })).resolves.toMatchObject({
      asset: { path: "assets/backgrounds/a.jpg" },
    });
    await expect(provider.createSceneVisual({ ...input, revision: 2 })).resolves.toMatchObject({
      asset: { path: "assets/backgrounds/b.jpg" },
    });
    await expect(provider.createSceneVisual({ ...input, revision: 3 })).resolves.toMatchObject({
      asset: { path: "assets/backgrounds/a.jpg" },
    });
  });
});
