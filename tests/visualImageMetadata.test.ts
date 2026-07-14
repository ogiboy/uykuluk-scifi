import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { inspectVisualImage } from "../src/stages/visuals/visualImageMetadata";

async function image(format: "jpeg" | "png" | "webp", width = 1280, height = 720) {
  const pipeline = sharp({
    create: { width, height, channels: 3, background: { r: 8, g: 16, b: 32 } },
  });
  return pipeline[format]().toBuffer();
}

describe("visual image decoder validation", () => {
  it("accepts fully decodable production-sized PNG and JPEG images", async () => {
    await expect(inspectVisualImage(await image("png"))).resolves.toMatchObject({
      format: "png",
      width: 1280,
      height: 720,
    });
    await expect(inspectVisualImage(await image("jpeg"))).resolves.toMatchObject({
      format: "jpeg",
      width: 1280,
      height: 720,
    });
  });

  it("rejects decodable formats outside the PNG/JPEG contract", async () => {
    await expect(inspectVisualImage(await image("webp"))).rejects.toThrow(/PNG or JPEG/i);
  });
});
