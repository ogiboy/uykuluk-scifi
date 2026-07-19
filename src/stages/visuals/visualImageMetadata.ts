import sharp from "sharp";
import { SafeExitError } from "../../core/errors.js";
import type { VisualMedia } from "./visualContracts.js";

const maximumVisualBytes = 25 * 1024 * 1024;
const minimumVisualWidth = 1280;
const minimumVisualHeight = 720;
const maximumVisualPixels = 40_000_000;

/** Validates and decodes a bounded JPEG or PNG import before returning trusted media facts. */
export async function inspectVisualImage(
  bytes: Buffer,
  minimum?: Readonly<{ height: number; width: number }>,
): Promise<VisualMedia> {
  const required = minimum ?? { width: minimumVisualWidth, height: minimumVisualHeight };
  if (bytes.byteLength === 0 || bytes.byteLength > maximumVisualBytes) {
    throw new SafeExitError("Manual visual import must be between 1 byte and 25 MiB.");
  }
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    const image = sharp(bytes, {
      failOn: "warning",
      limitInputPixels: maximumVisualPixels,
      sequentialRead: true,
    });
    metadata = await image.metadata();
    await image.clone().resize({ width: 1, height: 1, fit: "fill" }).raw().toBuffer();
  } catch {
    throw new SafeExitError("Manual visual import must be a supported PNG or JPEG image.");
  }
  if (
    (metadata.format !== "png" && metadata.format !== "jpeg") ||
    metadata.width === undefined ||
    metadata.height === undefined
  ) {
    throw new SafeExitError("Manual visual import must be a supported PNG or JPEG image.");
  }
  if (metadata.width < required.width || metadata.height < required.height) {
    throw new SafeExitError(
      `${minimum ? "Generated visual" : "Manual visual import"} must be at least ${required.width}x${required.height}.`,
    );
  }
  return {
    bytes: bytes.byteLength,
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
  };
}
