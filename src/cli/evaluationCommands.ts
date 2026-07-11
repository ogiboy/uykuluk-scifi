import { Command } from "commander";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { localProviderBaseUrlSchema } from "../config/schema.js";
import { SafeExitError } from "../core/errors.js";
import {
  localModelCandidateEvalRequiresMoreCandidates,
  runLocalModelCandidateEval,
} from "../diagnostics/localModelCandidateEval.js";
import { formatLocalModelCandidateEvalConsole } from "../diagnostics/localModelCandidateEvalFormatting.js";
import { runLocalModelEval } from "../diagnostics/localModelEval.js";
import { LocalModelEvalLlmOverrides } from "../diagnostics/localModelEvalConfig.js";
import { formatLocalModelEvalConsole } from "../diagnostics/localModelEvalFormatting.js";

type Wrap = <T extends unknown[]>(handler: (...args: T) => Promise<void>) => (...args: T) => void;

type LocalModelEvalCliOptions = {
  candidate?: string[];
  includeLocalGguf?: boolean;
  json?: boolean;
  llamaCppBaseUrl?: string;
  llmMode?: string;
  model?: string;
  ollamaBaseUrl?: string;
  requestTimeoutMs?: string;
  thinkingMode?: string;
};

const llmModeSchema = z.enum(["mock", "ollama", "llama.cpp"]);
const thinkingModeSchema = z.enum(["default", "think", "no_think"]);
const collectOption = (value: string, previous: string[] = []): string[] => [...previous, value];

/**
 * Registers local model evaluation commands.
 *
 * @param program - The Commander program to extend.
 * @param wrap - Wraps async command handlers for Commander.
 */
export function registerEvaluationCommands(program: Command, wrap: Wrap): void {
  const evalCommand = program.command("eval").description("Local evaluation commands.");
  evalCommand
    .command("local-model")
    .option("--json", "Print the raw local model evaluation JSON for automation.")
    .option("--llm-mode <mode>", "Override only this eval run's LLM mode.")
    .option("--model <model>", "Override only this eval run's model name.")
    .option("--ollama-base-url <url>", "Override only this eval run's Ollama base URL.")
    .option("--llama-cpp-base-url <url>", "Override only this eval run's llama.cpp base URL.")
    .option("--thinking-mode <mode>", "Override only this eval run's Ollama thinking mode.")
    .option("--request-timeout-ms <ms>", "Override only this eval run's provider timeout.")
    .description("Evaluate the configured local LLM against small production parser contracts.")
    .action(
      wrap(async (options: LocalModelEvalCliOptions) => {
        const report = await runLocalModelEval({
          llmOverrides: parseLocalModelEvalOverrides(options),
        });
        console.log(
          options.json ? JSON.stringify(report, null, 2) : formatLocalModelEvalConsole(report),
        );
        if (!report.passed) {
          throw new SafeExitError("Local model eval blocked.", 1);
        }
      }),
    );
  evalCommand
    .command("local-model-candidates")
    .option("--json", "Print the raw local model candidate evaluation JSON for automation.")
    .option(
      "--candidate <model>",
      "Add a model candidate to evaluate; repeat for multiple candidates.",
      collectOption,
      [],
    )
    .option(
      "--include-local-gguf",
      "Add ignored local GGUF files from models/llm as candidate model ids.",
    )
    .option("--llm-mode <mode>", "Override only this eval run's LLM mode.")
    .option("--ollama-base-url <url>", "Override only this eval run's Ollama base URL.")
    .option("--llama-cpp-base-url <url>", "Override only this eval run's llama.cpp base URL.")
    .option("--thinking-mode <mode>", "Override only this eval run's Ollama thinking mode.")
    .option("--request-timeout-ms <ms>", "Override only this eval run's provider timeout.")
    .description("Compare local model candidates against small production parser contracts.")
    .action(
      wrap(async (options: LocalModelEvalCliOptions) => {
        const candidates = await parseCandidates(
          options.candidate ?? [],
          Boolean(options.includeLocalGguf),
        );
        const report = await runLocalModelCandidateEval({
          candidates,
          llmOverrides: parseLocalModelEvalBaseOverrides(options),
        });
        console.log(
          options.json
            ? JSON.stringify(report, null, 2)
            : formatLocalModelCandidateEvalConsole(report),
        );
        if (localModelCandidateEvalRequiresMoreCandidates(report)) {
          throw new SafeExitError("Local model candidate eval needs more candidates.", 1);
        }
      }),
    );
}

/**
 * Parses eval-only CLI provider overrides into the diagnostics config shape.
 *
 * @param options - Commander options from `producer eval local-model`.
 * @returns Provider overrides that apply only to the current evaluation run.
 */
function parseLocalModelEvalOverrides(
  options: LocalModelEvalCliOptions,
): LocalModelEvalLlmOverrides {
  return { ...parseLocalModelEvalBaseOverrides(options), model: options.model };
}

/**
 * Parses eval-only CLI provider overrides that are shared by all candidate models.
 *
 * @param options - Commander options from a local model eval command.
 * @returns Provider overrides that apply only to the current evaluation run.
 */
function parseLocalModelEvalBaseOverrides(
  options: LocalModelEvalCliOptions,
): Omit<LocalModelEvalLlmOverrides, "model"> {
  const requestTimeoutMs =
    options.requestTimeoutMs === undefined
      ? undefined
      : z.coerce.number().int().positive().parse(options.requestTimeoutMs);
  return {
    llamaCppBaseUrl:
      options.llamaCppBaseUrl === undefined
        ? undefined
        : localProviderBaseUrlSchema.parse(options.llamaCppBaseUrl),
    mode: options.llmMode === undefined ? undefined : llmModeSchema.parse(options.llmMode),
    ollamaBaseUrl:
      options.ollamaBaseUrl === undefined
        ? undefined
        : localProviderBaseUrlSchema.parse(options.ollamaBaseUrl),
    requestTimeoutMs,
    thinkingMode:
      options.thinkingMode === undefined
        ? undefined
        : thinkingModeSchema.parse(options.thinkingMode),
  };
}

/**
 * Validates and de-duplicates candidate model names from repeated CLI options and local GGUF files.
 *
 * @param candidates - Candidate model names passed via `--candidate`.
 * @param includeLocalGguf - Whether to include ignored `models/llm/*.gguf` files.
 * @returns A stable non-empty candidate list.
 */
async function parseCandidates(candidates: string[], includeLocalGguf: boolean): Promise<string[]> {
  const localGgufCandidates = includeLocalGguf ? await listLocalGgufCandidates() : [];
  const uniqueCandidates = Array.from(
    new Set([...candidates.map((candidate) => candidate.trim()), ...localGgufCandidates]),
  );
  const nonEmptyCandidates = uniqueCandidates.filter((candidate) => candidate.length > 0);
  if (nonEmptyCandidates.length === 0) {
    throw new SafeExitError(
      "At least one --candidate <model> or --include-local-gguf model is required.",
      1,
    );
  }
  return nonEmptyCandidates;
}

/**
 * Lists ignored local GGUF files from the conventional project model directory.
 *
 * @returns Stable llama.cpp model ids using repo-relative `models/llm/<file>.gguf` paths.
 */
async function listLocalGgufCandidates(): Promise<string[]> {
  const localModelDir = path.join(process.cwd(), "models", "llm");
  let entries;
  try {
    entries = await readdir(localModelDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".gguf"))
    .map((entry) => path.posix.join("models", "llm", entry.name))
    .sort((left, right) => left.localeCompare(right));
}
