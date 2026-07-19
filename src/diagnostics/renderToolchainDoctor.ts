import { spawnSync } from "node:child_process";
import type { DoctorCheck } from "./doctorSchema.js";

const renderTools = [
  { binary: "ffmpeg", label: "FFmpeg" },
  { binary: "ffprobe", label: "ffprobe" },
] as const;

const renderToolTimeoutMs = 2_000;
const renderToolSetupCommand =
  "Install FFmpeg/ffprobe, ensure both commands are on PATH, then rerun pnpm producer doctor.";

/**
 * Checks whether local draft-render command-line tools are available.
 *
 * @returns A diagnostic check for the local FFmpeg render toolchain.
 */
export function renderToolchainCheck(): DoctorCheck {
  const unavailable = renderTools
    .filter((tool) => !isRenderToolAvailable(tool.binary))
    .map((tool) => tool.label);

  if (unavailable.length === 0) {
    if (!ffmpegSupportsLoudnorm()) {
      return {
        name: "render toolchain",
        status: "warn",
        message:
          "FFmpeg and ffprobe are available, but the required FFmpeg loudnorm filter is unavailable.",
        nextAction: renderToolSetupCommand,
      };
    }
    return {
      name: "render toolchain",
      status: "pass",
      message: "FFmpeg, ffprobe, and two-pass loudnorm are available for local draft render.",
    };
  }

  return {
    name: "render toolchain",
    status: "warn",
    message: `${unavailable.join(", ")} unavailable; local draft render will fail until the toolchain is installed.`,
    nextAction: renderToolSetupCommand,
  };
}

function ffmpegSupportsLoudnorm(): boolean {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-filters"], {
    encoding: "utf8",
    timeout: renderToolTimeoutMs,
  });
  return result.status === 0 && /\bloudnorm\b/u.test(`${result.stdout}${result.stderr}`);
}

function isRenderToolAvailable(binary: string): boolean {
  const result = spawnSync(binary, ["-version"], { stdio: "ignore", timeout: renderToolTimeoutMs });
  return result.status === 0;
}
