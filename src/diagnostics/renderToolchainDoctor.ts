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
    return {
      name: "render toolchain",
      status: "pass",
      message: "FFmpeg and ffprobe are available for local draft render.",
    };
  }

  return {
    name: "render toolchain",
    status: "warn",
    message: `${unavailable.join(", ")} unavailable; local draft render will fail until the toolchain is installed.`,
    nextAction: renderToolSetupCommand,
  };
}

function isRenderToolAvailable(binary: string): boolean {
  const result = spawnSync(binary, ["-version"], {
    stdio: "ignore",
    timeout: renderToolTimeoutMs,
  });
  return result.status === 0;
}
