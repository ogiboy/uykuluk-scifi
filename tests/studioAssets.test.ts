import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getStudioAssetInventory } from "../apps/studio/src/lib/assetInventory";
import { useTempProject } from "./helpers";

describe("Studio read-only asset inventory", () => {
  useTempProject();

  it("reads configured asset guard directories and render-support asset categories", async () => {
    await writeFile("assets/brand/channel_logo.png", "logo", "utf8");
    await writeFile("assets/brand/channel_watermark.png", "watermark", "utf8");
    await writeFile("assets/overlays/subtitle_panel.png", "overlay", "utf8");
    await writeFile("assets/intro/episode_title_card.jpg", "intro", "utf8");
    await writeFile("assets/outro/youtube_end_screen.jpg", "outro", "utf8");
    await mkdir("assets/backgrounds", { recursive: true });
    await writeFile("assets/backgrounds/plate_01.jpg", "background", "utf8");
    await mkdir("assets/waveforms", { recursive: true });
    await writeFile("assets/waveforms/waveform.png", "waveform", "utf8");

    const inventory = await getStudioAssetInventory();

    expect(inventory).toMatchObject({
      configSource: "producer.config.json",
      configValid: true,
      passed: true,
      warnings: [],
    });
    expect(inventory.totalFiles).toBeGreaterThanOrEqual(7);
    expect(inventory.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          directory: "assets/brand",
          files: expect.arrayContaining([
            "assets/brand/channel_logo.png",
            "assets/brand/channel_watermark.png",
          ]),
          guarded: true,
          id: "brand",
          status: "ready",
        }),
        expect.objectContaining({
          directory: "assets/backgrounds",
          files: ["assets/backgrounds/plate_01.jpg"],
          guarded: false,
          id: "backgrounds",
          status: "ready",
        }),
      ]),
    );
  });

  it("surfaces invalid producer config without reporting asset readiness", async () => {
    await writeFile("producer.config.json", "{ invalid json", "utf8");

    const inventory = await getStudioAssetInventory();

    expect(inventory).toMatchObject({
      configSource: "producer.config.json",
      configValid: false,
      passed: false,
    });
    expect(inventory.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Producer config is invalid"),
        expect.stringContaining("Missing brand logo asset"),
      ]),
    );
  });
});
