import { Command } from "commander";
import { z } from "zod";
import { SafeExitError } from "../core/errors.js";
import { runLocalModelEval } from "../diagnostics/localModelEval.js";
import { LocalModelEvalLlmOverrides } from "../diagnostics/localModelEvalConfig.js";
import { formatLocalModelEvalConsole } from "../diagnostics/localModelEvalFormatting.js";

type Wrap = <T extends unknown[]>(handler: (...args: T) => Promise<void>) => (...args: T) => void;

type LocalModelEvalCliOptions = {
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
  const requestTimeoutMs =
    options.requestTimeoutMs === undefined
      ? undefined
      : z.coerce.number().int().positive().parse(options.requestTimeoutMs);
  return {
    llamaCppBaseUrl: options.llamaCppBaseUrl,
    mode: options.llmMode === undefined ? undefined : llmModeSchema.parse(options.llmMode),
    model: options.model,
    ollamaBaseUrl: options.ollamaBaseUrl,
    requestTimeoutMs,
    thinkingMode:
      options.thinkingMode === undefined
        ? undefined
        : thinkingModeSchema.parse(options.thinkingMode),
  };
}
