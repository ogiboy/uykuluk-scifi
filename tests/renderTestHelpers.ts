import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function enableDeterministicTts(): Promise<void> {
  const config = JSON.parse(await readFile("producer.config.json", "utf8")) as {
    providers: { tts: Record<string, unknown> };
  };
  config.providers.tts = { enabled: true, mode: "deterministic-local" };
  await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function createFakeFfmpeg(): Promise<string> {
  const target = path.join(process.cwd(), "fake-ffmpeg.mjs");
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

export async function createFakeFfprobe(): Promise<string> {
  const target = path.join(process.cwd(), "fake-ffprobe.mjs");
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

export async function createFailingFakeFfprobe(): Promise<string> {
  const target = path.join(process.cwd(), "fake-failing-ffprobe.mjs");
  await writeFile(
    target,
    ["#!/usr/bin/env node", 'console.error("invalid media");', "process.exit(1);"].join("\n"),
    "utf8",
  );
  await chmod(target, 0o755);
  return target;
}

export async function createMinimalRenderAssets(): Promise<void> {
  const files = new Map([
    ["assets/brand/uykulukscifi_channel_logo_square_1024.png", "logo"],
    ["assets/brand/uykulukscifi_watermark_transparent_500.png", "watermark"],
    ["assets/overlays/subtitle_panel_blank_1700x190.png", "subtitle panel"],
    ["assets/overlays/video_lower_third_banner_1920x240.png", "lower third"],
    ["assets/overlays/popup_info_card_900x520.png", "popup card"],
    ["assets/intro/episode_title_card_1920x1080.jpg", "intro"],
    ["assets/outro/youtube_end_screen_1920x1080.jpg", "outro"],
    ["assets/backgrounds/plate_test_1920x1080.jpg", "background"],
    ["assets/icons/icon_fact_check_512.png", "fact icon"],
    ["assets/waveforms/waveform_overlay_thin_panel_transparent_1920x240.png", "waveform"],
  ]);
  for (const [target, content] of files) {
    await mkdir(target.split("/").slice(0, -1).join("/"), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}
