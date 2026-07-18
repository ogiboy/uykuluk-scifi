import type { ProducerConfig } from "../../../../../src/config/schema";
import type { DraftUpdater } from "./settingsTypes";

export function createProviderControls(updateDraft: DraftUpdater) {
  const updateLlm = <K extends keyof ProducerConfig["providers"]["llm"]>(
    key: K,
    value: ProducerConfig["providers"]["llm"][K],
  ) =>
    updateDraft((current) => ({
      ...current,
      providers: { ...current.providers, llm: { ...current.providers.llm, [key]: value } },
    }));
  const setTts = (mode: "disabled" | ProducerConfig["providers"]["tts"]["mode"]) =>
    updateDraft((current) => ({
      ...current,
      providers: {
        ...current.providers,
        tts: {
          ...current.providers.tts,
          enabled: mode !== "disabled",
          mode: mode === "disabled" ? current.providers.tts.mode : mode,
        },
      },
    }));
  const setVisual = (mode: "disabled" | ProducerConfig["providers"]["imageGeneration"]["mode"]) =>
    updateDraft((current) => ({
      ...current,
      providers: {
        ...current.providers,
        imageGeneration: {
          ...current.providers.imageGeneration,
          enabled: mode !== "disabled",
          mode: mode === "disabled" ? current.providers.imageGeneration.mode : mode,
        },
      },
    }));
  const updateBudget = <K extends keyof ProducerConfig["budgets"]>(key: K, value: number) =>
    updateDraft((current) => ({ ...current, budgets: { ...current.budgets, [key]: value } }));
  return { setTts, setVisual, updateBudget, updateLlm };
}
