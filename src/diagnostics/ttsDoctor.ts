import { spawnSync } from "node:child_process";
import path from "node:path";
import type { ProducerConfig } from "../config/schema.js";
import { pathExists } from "../utils/fs.js";
import type { DoctorCheck } from "./doctor.js";

const piperSetupCommand = "pnpm tts:piper:setup";

/**
 * Diagnoses the configured text-to-speech provider and reports its readiness.
 *
 * @param config - Project configuration containing the TTS provider settings, if available.
 * @returns A diagnostic result indicating whether the configured TTS provider is ready, disabled, or blocked by missing prerequisites.
 */
export async function ttsProviderCheck(config: ProducerConfig | undefined): Promise<DoctorCheck> {
  if (!config) {
    return {
      name: "TTS provider",
      status: "block",
      message: "TTS diagnostics require valid project config.",
      nextAction: "Fix producer.config.json, then rerun pnpm producer doctor.",
    };
  }

  const tts = config.providers.tts;
  if (!tts.enabled) {
    return {
      name: "TTS provider",
      status: "pass",
      message: "TTS is disabled by default; local voiceover generation remains opt-in.",
      nextAction: `${piperSetupCommand} when you are ready to test local Piper voiceover.`,
    };
  }
  if (tts.mode === "deterministic-local") {
    return {
      name: "TTS provider",
      status: "pass",
      message: "deterministic-local reference TTS is configured for timing validation.",
      nextAction: "Use local-piper only after voice quality review is needed.",
    };
  }
  if (tts.mode === "elevenlabs") {
    return elevenLabsDiagnostic(tts);
  }

  return piperDiagnostic(tts);
}

/**
 * Validates ElevenLabs TTS configuration and server credentials.
 *
 * @param tts - The configured TTS provider settings.
 * @returns A diagnostic result indicating whether ElevenLabs is ready or blocked by missing prerequisites.
 */
function elevenLabsDiagnostic(tts: ProducerConfig["providers"]["tts"]): DoctorCheck {
  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    return {
      name: "TTS provider",
      status: "block",
      message:
        "ELEVENLABS_API_KEY missing from the server environment. ElevenLabs remains blocked before audition or cost reservation.",
      nextAction: "Configure server-side ELEVENLABS_API_KEY, then rerun pnpm producer doctor.",
    };
  }
  return {
    name: "TTS provider",
    status: "pass",
    message: `ElevenLabs is configured with ${tts.elevenLabs.modelId} and a server-side credential.`,
    nextAction:
      "Run pnpm producer voice-candidates --run <run_id> to begin run-scoped audition and selection before estimating cost.",
  };
}

/**
 * Reports whether the local Piper text-to-speech provider is ready for use.
 *
 * @param tts - The configured TTS provider settings.
 * @returns The provider readiness check, including any missing Piper prerequisites.
 */
async function piperDiagnostic(tts: ProducerConfig["providers"]["tts"]): Promise<DoctorCheck> {
  const findings = await piperFindings(tts);
  if (findings.length === 0) {
    return {
      name: "TTS provider",
      status: "pass",
      message: `local-piper is configured with ${tts.piperModelPath}.`,
      nextAction: "Run pnpm producer voice only after readiness and script approval.",
    };
  }
  return {
    name: "TTS provider",
    status: "block",
    message: `${findings.join("; ")}. Local Piper remains blocked.`,
    nextAction: `${piperSetupCommand}, then copy the printed providers.tts override into producer.config.json.`,
  };
}

async function piperFindings(tts: ProducerConfig["providers"]["tts"]): Promise<string[]> {
  const findings: string[] = [];
  if (!isCommandAvailable(tts.piperBinary ?? "piper")) {
    findings.push("Piper binary unavailable");
  }
  if (!tts.piperModelPath || !(await pathExists(resolveLocalPath(tts.piperModelPath)))) {
    findings.push("Piper model missing");
  }
  if (!tts.piperConfigPath || !(await pathExists(resolveLocalPath(tts.piperConfigPath)))) {
    findings.push("Piper config missing");
  }
  return findings;
}

function isCommandAvailable(binary: string): boolean {
  const result = spawnSync(binary, ["--help"], { stdio: "ignore" });
  return result.status === 0;
}

function resolveLocalPath(value: string): string {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}
