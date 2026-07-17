import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StudioLocale } from "@/i18n/locales";
import type { ProducerConfig } from "../../../../../src/config/schema";
import type { StudioSettingsCopy } from "./settingsCopy";
import { BudgetInput, Field } from "./settingsFormPrimitives";
import {
  budgetLabel,
  deterministicLabel,
  disabledLabel,
  staticManualLabel,
} from "./settingsLabels";

export function LlmSettings({
  copy,
  draft,
  timeoutLabel,
  updateLlm,
}: Readonly<{
  copy: StudioSettingsCopy;
  draft: ProducerConfig;
  timeoutLabel: string;
  updateLlm: <K extends keyof ProducerConfig["providers"]["llm"]>(
    key: K,
    value: ProducerConfig["providers"]["llm"][K],
  ) => void;
}>) {
  return (
    <div className='grid gap-4 md:grid-cols-3'>
      <Field label={copy.provider}>
        <Select
          value={draft.providers.llm.mode}
          onValueChange={(value) =>
            updateLlm("mode", value as ProducerConfig["providers"]["llm"]["mode"])
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='mock'>Mock</SelectItem>
            <SelectItem value='ollama'>Ollama</SelectItem>
            <SelectItem value='llama.cpp'>llama.cpp</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={copy.model}>
        <Input
          value={draft.providers.llm.model}
          onChange={(event) => updateLlm("model", event.target.value)}
        />
      </Field>
      <Field label={timeoutLabel}>
        <Input
          min={1}
          type='number'
          value={Math.round(draft.providers.llm.requestTimeoutMs / 1000)}
          onChange={(event) => updateLlm("requestTimeoutMs", Number(event.target.value) * 1000)}
        />
      </Field>
    </div>
  );
}

export function DefaultProviderSettings({
  draft,
  locale,
  setTts,
  setVisual,
  visualLabel,
  voiceLabel,
}: Readonly<{
  draft: ProducerConfig;
  locale: StudioLocale;
  setTts: (mode: "disabled" | ProducerConfig["providers"]["tts"]["mode"]) => void;
  setVisual: (mode: "disabled" | ProducerConfig["providers"]["imageGeneration"]["mode"]) => void;
  visualLabel: string;
  voiceLabel: string;
}>) {
  return (
    <div className='grid gap-4 md:grid-cols-2'>
      <Field label={voiceLabel}>
        <Select
          value={activeTtsMode(draft)}
          onValueChange={(value) =>
            setTts(value as "disabled" | ProducerConfig["providers"]["tts"]["mode"])
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='disabled'>{disabledLabel(locale)}</SelectItem>
            <SelectItem value='deterministic-local'>{deterministicLabel(locale)}</SelectItem>
            <SelectItem value='local-piper'>Piper</SelectItem>
            <SelectItem value='elevenlabs'>ElevenLabs v3</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={visualLabel}>
        <Select
          value={activeVisualMode(draft)}
          onValueChange={(value) =>
            setVisual(value as "disabled" | ProducerConfig["providers"]["imageGeneration"]["mode"])
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='disabled'>{disabledLabel(locale)}</SelectItem>
            <SelectItem value='static-manual'>{staticManualLabel(locale)}</SelectItem>
            <SelectItem value='black-forest-labs'>BFL FLUX.2 Pro</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

export function BudgetSettings({
  draft,
  locale,
  updateBudget,
}: Readonly<{
  draft: ProducerConfig;
  locale: StudioLocale;
  updateBudget: <K extends keyof ProducerConfig["budgets"]>(key: K, value: number) => void;
}>) {
  return (
    <div className='grid gap-4 md:grid-cols-4'>
      <BudgetInput
        label={budgetLabel(locale, "episode")}
        value={draft.budgets.perVideoUsd}
        onChange={(value) => updateBudget("perVideoUsd", value)}
      />
      <BudgetInput
        label={budgetLabel(locale, "daily")}
        value={draft.budgets.dailyUsd}
        onChange={(value) => updateBudget("dailyUsd", value)}
      />
      <BudgetInput
        label={budgetLabel(locale, "weekly")}
        value={draft.budgets.weeklyUsd}
        onChange={(value) => updateBudget("weeklyUsd", value)}
      />
      <BudgetInput
        label={budgetLabel(locale, "approval")}
        value={draft.budgets.requireApprovalAboveUsd}
        onChange={(value) => updateBudget("requireApprovalAboveUsd", value)}
      />
    </div>
  );
}

function activeTtsMode(draft: ProducerConfig) {
  return draft.providers.tts.enabled ? draft.providers.tts.mode : "disabled";
}

function activeVisualMode(draft: ProducerConfig) {
  return draft.providers.imageGeneration.enabled
    ? draft.providers.imageGeneration.mode
    : "disabled";
}
