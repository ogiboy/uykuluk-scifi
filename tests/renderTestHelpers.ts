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
 * @param binaryName - The executable filename to create.
 * @returns The path to the generated script.
 */
export async function createFakeFfmpeg(
  root: string,
  binaryName = "fake-ffmpeg.mjs",
): Promise<string> {
  const target = path.join(root, binaryName);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    [
      "#!/usr/bin/env node",
      'import { writeFileSync } from "node:fs";',
      "const args = process.argv.slice(2);",
      "if (args.at(-1) === '-' && args.some((value) => value.includes('loudnorm='))) {",
      "  console.error(JSON.stringify({",
      "    input_i: '-14.0',",
      "    input_tp: '-1.2',",
      "    input_lra: '5.0',",
      "    input_thresh: '-24.0',",
      "    target_offset: '0.0'",
      "  }));",
      "  process.exit(0);",
      "}",
      "const output = process.argv.at(-1);",
      'writeFileSync(output, Buffer.from(`fake mp4\\n${args.join("\\n")}`));',
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
 * @param binaryName - The executable filename to create.
 * @returns The path to the generated script.
 */
export async function createFakeFfprobe(
  root: string,
  binaryName = "fake-ffprobe.mjs",
): Promise<string> {
  const target = path.join(root, binaryName);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    [
      "#!/usr/bin/env node",
      'import { readFileSync } from "node:fs";',
      "const media = readFileSync(process.argv.at(-1), 'utf8');",
      "const args = media.split('\\n');",
      "const durationIndex = args.lastIndexOf('-t');",
      "const duration = durationIndex >= 0 ? args[durationIndex + 1] : '8.000000';",
      "console.log(JSON.stringify({",
      "  format: { duration, format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },",
      "  streams: [",
      "    { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, duration },",
      "    { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2, duration }",
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
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    ["#!/usr/bin/env node", 'console.error("invalid media");', "process.exit(1);"].join("\n"),
    "utf8",
  );
  await chmod(target, 0o755);
  return target;
}

/**
 * Builds an isolated temp-project path for fake render tools.
 *
 * @param scope - The caller-specific tool directory name.
 * @returns A directory path beneath the current temp project.
 */
export function renderToolRoot(scope: string): string {
  return path.join(process.cwd(), ".tmp", "render-tools", scope);
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
    ["assets/thumbnails/thumbnail_template_01_left_1280x720.jpg", "thumbnail template"],
    ["assets/thumbnails/thumbnail_text_safe_overlay_01_left_1280x720.png", "thumbnail overlay"],
    ["assets/backgrounds/plate_test_1920x1080.jpg", "background"],
    ["assets/icons/icon_fact_check_512.png", "fact icon"],
    ["assets/waveforms/waveform_overlay_thin_panel_transparent_1920x240.png", "waveform"],
  ]);
  for (const [target, content] of files) {
    await mkdir(target.split("/").slice(0, -1).join("/"), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}
