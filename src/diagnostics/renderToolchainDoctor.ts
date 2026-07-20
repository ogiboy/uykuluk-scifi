import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";
import type { DoctorCheck } from "./doctorSchema.js";

const renderTools = [
  { binary: "ffmpeg", label: "FFmpeg" },
  { binary: "ffprobe", label: "ffprobe" },
] as const;

const renderToolTimeoutMs = 2_000;
const renderToolDirectories = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"] as const;
const renderToolSetupCommand =
  "Install FFmpeg/ffprobe in a standard executable location, then rerun pnpm producer doctor.";

/** Explicit absolute render-tool paths used by diagnostics and isolated tests. */
export type RenderToolchainOptions = Readonly<{ ffmpegBinary?: string; ffprobeBinary?: string }>;

/**
 * Checks whether local draft-render command-line tools are available.
 *
 * @returns A diagnostic check for the local FFmpeg render toolchain.
 */
export function renderToolchainCheck(options: RenderToolchainOptions = {}): DoctorCheck {
  const unavailable = renderTools
    .filter((tool) => !isRenderToolAvailable(resolveRenderTool(tool.binary, options)))
    .map((tool) => tool.label);

  if (unavailable.length === 0) {
    if (!ffmpegSupportsLoudnorm(resolveRenderTool("ffmpeg", options))) {
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

function ffmpegSupportsLoudnorm(binary: string | undefined): boolean {
  if (!binary) return false;
  const result = spawnSync(binary, ["-hide_banner", "-filters"], {
    encoding: "utf8",
    timeout: renderToolTimeoutMs,
  });
  return result.status === 0 && /\bloudnorm\b/u.test(`${result.stdout}${result.stderr}`);
}

function isRenderToolAvailable(binary: string | undefined): boolean {
  if (!binary) return false;
  const result = spawnSync(binary, ["-version"], { stdio: "ignore", timeout: renderToolTimeoutMs });
  return result.status === 0;
}

function resolveRenderTool(
  binary: "ffmpeg" | "ffprobe",
  options: RenderToolchainOptions,
): string | undefined {
  const explicit = binary === "ffmpeg" ? options.ffmpegBinary : options.ffprobeBinary;
  if (explicit) return executablePath(explicit);
  for (const directory of renderToolDirectories) {
    const candidate = path.join(directory, binary);
    const executable = executablePath(candidate);
    if (executable) return executable;
  }
  return undefined;
}

function executablePath(candidate: string): string | undefined {
  if (!path.isAbsolute(candidate)) return undefined;
  try {
    const resolved = path.resolve(candidate);
    accessSync(resolved, constants.X_OK);
    return resolved;
  } catch {
    return undefined;
  }
}
