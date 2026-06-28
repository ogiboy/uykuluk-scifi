import { ProducerConfig } from "../config/schema.js";

export type LocalModelEvalLlmOverrides = Partial<
  Pick<
    ProducerConfig["providers"]["llm"],
    | "llamaCppBaseUrl"
    | "maxOutputTokens"
    | "mode"
    | "model"
    | "ollamaBaseUrl"
    | "requestTimeoutMs"
    | "thinkingMode"
  >
>;

export type LocalModelEvalConfigResult = {
  appliedOverrides: string[];
  config: ProducerConfig;
};

/**
 * Applies one-run local model evaluation overrides without mutating the loaded project config.
 *
 * @param config - The loaded project configuration.
 * @param overrides - Optional local-model evaluation provider overrides.
 * @returns The derived config and the stable list of override keys that were applied.
 */
export function applyLocalModelEvalOverrides(
  config: ProducerConfig,
  overrides: LocalModelEvalLlmOverrides = {},
): LocalModelEvalConfigResult {
  const appliedOverrides = Object.entries(overrides)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));

  if (appliedOverrides.length === 0) {
    return { appliedOverrides, config };
  }

  return {
    appliedOverrides,
    config: {
      ...config,
      providers: {
        ...config.providers,
        llm: {
          ...config.providers.llm,
          ...withoutUndefined(overrides),
        },
      },
    },
  };
}

/**
 * Removes undefined override values before merging them into the provider config.
 *
 * @param overrides - Optional local-model evaluation provider overrides.
 * @returns A partial provider config containing only explicitly supplied values.
 */
function withoutUndefined(
  overrides: LocalModelEvalLlmOverrides,
): Partial<ProducerConfig["providers"]["llm"]> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<ProducerConfig["providers"]["llm"]>;
}
