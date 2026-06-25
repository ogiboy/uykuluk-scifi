import { spawnSync } from "node:child_process";
import path from "node:path";
import type { ProducerConfig } from "../config/schema.js";
import { pathExists } from "../utils/fs.js";
import type { DoctorCheck } from "./doctor.js";

const piperSetupCommand = "pnpm tts:piper:setup";

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

  return piperDiagnostic(tts);
}

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
