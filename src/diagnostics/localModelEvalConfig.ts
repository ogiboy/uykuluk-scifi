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

function withoutUndefined(
  overrides: LocalModelEvalLlmOverrides,
): Partial<ProducerConfig["providers"]["llm"]> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<ProducerConfig["providers"]["llm"]>;
}
