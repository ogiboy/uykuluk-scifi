import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Enables deterministic local text-to-speech in the producer configuration.
 *
 * @param root - The temp project root containing `producer.config.json`.
 */
export async function enableDeterministicTts(root: string): Promise<void> {
  const target = path.join(root, "producer.config.json");
  const config = JSON.parse(await readFile(target, "utf8")) as {
    providers: { tts: Record<string, unknown> };
  };
  config.providers.tts = { enabled: true, mode: "deterministic-local" };
  await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

/**
 * Creates a fake FFmpeg executable in the temp project root.
 *
 * @param root - The temp project root where the script should be written.
 * @returns The path to the generated script.
 */
export async function createFakeFfmpeg(root: string): Promise<string> {
  const target = path.join(root, "fake-ffmpeg.mjs");
  await writeFile(
    target,
    [
      "#!/usr/bin/env node",
      'import { writeFileSync } from "node:fs";',
      "const output = process.argv.at(-1);",
      'writeFileSync(output, Buffer.from(`fake mp4\\n${process.argv.slice(2).join("\\n")}`));',
    ].join("\n"),
    "utf8",
  );
  await chmod(target, 0o755);
  return target;
}

/**
 * Creates a fake FFprobe executable that prints fixed media metadata.
 *
 * @param root - The temp project root where the script should be written.
 * @returns The path to the generated script.
 */
export async function createFakeFfprobe(root: string): Promise<string> {
  const target = path.join(root, "fake-ffprobe.mjs");
  await writeFile(
    target,
    [
      "#!/usr/bin/env node",
      "console.log(JSON.stringify({",
      "  format: { duration: '8.000000', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },",
      "  streams: [",
      "    { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, duration: '8.000000' },",
      "    { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2, duration: '8.000000' }",
      "  ]",
      "}));",
    ].join("\n"),
    "utf8",
  );
  await chmod(target, 0o755);
  return target;
}

/**
 * Creates a failing fake FFprobe script.
 *
 * @param root - The temp project root where the script should be written.
 * @returns The path to the generated script.
 */
export async function createFailingFakeFfprobe(root: string): Promise<string> {
  const target = path.join(root, "fake-failing-ffprobe.mjs");
  await writeFile(
    target,
    ["#!/usr/bin/env node", 'console.error("invalid media");', "process.exit(1);"].join("\n"),
    "utf8",
  );
  await chmod(target, 0o755);
  return target;
}

/**
 * Creates a minimal set of render asset files on disk.
 */
export async function createMinimalRenderAssets(): Promise<void> {
  const files = new Map([
    ["assets/brand/uykulukscifi_channel_logo_square_1024.png", "logo"],
    ["assets/brand/uykulukscifi_watermark_transparent_500.png", "watermark"],
    ["assets/overlays/subtitle_panel_blank_1700x190.png", "subtitle panel"],
    ["assets/overlays/video_lower_third_banner_1920x240.png", "lower third"],
    ["assets/overlays/popup_info_card_900x520.png", "popup card"],
    ["assets/intro/episode_title_card_1920x1080.jpg", "intro"],
    ["assets/intro/frames/intro_frame_00.jpg", "intro frame 0"],
    ["assets/intro/frames/intro_frame_01.jpg", "intro frame 1"],
    ["assets/outro/youtube_end_screen_1920x1080.jpg", "outro"],
    ["assets/outro/frames/outro_frame_00.jpg", "outro frame 0"],
    ["assets/outro/frames/outro_frame_01.jpg", "outro frame 1"],
    ["assets/backgrounds/plate_test_1920x1080.jpg", "background"],
    ["assets/icons/icon_fact_check_512.png", "fact icon"],
    ["assets/waveforms/waveform_overlay_thin_panel_transparent_1920x240.png", "waveform"],
  ]);
  for (const [target, content] of files) {
    await mkdir(target.split("/").slice(0, -1).join("/"), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}
