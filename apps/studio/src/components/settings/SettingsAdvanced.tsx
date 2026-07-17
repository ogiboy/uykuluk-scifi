import type { StudioLocale } from "@/i18n/locales";
import type { ProducerConfig } from "../../../../../src/config/schema";
import { BudgetSettings, DefaultProviderSettings, LlmSettings } from "./SettingsAdvancedFields";
import type { StudioSettingsCopy } from "./settingsCopy";
import { createProviderControls } from "./settingsProviderControls";
import type { DraftUpdater } from "./settingsTypes";

export function SettingsAdvanced({
  copy,
  draft,
  locale,
  updateDraft,
}: Readonly<{
  copy: StudioSettingsCopy;
  draft: ProducerConfig;
  locale: StudioLocale;
  updateDraft: DraftUpdater;
}>) {
  const controls = createProviderControls(updateDraft);
  const labels =
    locale === "tr"
      ? {
          timeout: "İstek zaman aşımı (sn)",
          visual: "Varsayılan görsel yolu",
          voice: "Varsayılan ses yolu",
        }
      : {
          timeout: "Request timeout (sec)",
          visual: "Default visual path",
          voice: "Default voice path",
        };
  return (
    <details
      className='bg-muted/15 rounded-xl border border-(--line) px-4 py-1'
      data-testid='settings-advanced'
    >
      <summary className='cursor-pointer py-3 text-sm font-medium'>{copy.advanced}</summary>
      <div className='grid gap-5 border-t py-4'>
        <p className='text-muted-foreground text-sm'>{copy.advancedDescription}</p>
        <LlmSettings
          copy={copy}
          draft={draft}
          timeoutLabel={labels.timeout}
          updateLlm={controls.updateLlm}
        />
        <DefaultProviderSettings
          draft={draft}
          locale={locale}
          setTts={controls.setTts}
          setVisual={controls.setVisual}
          visualLabel={labels.visual}
          voiceLabel={labels.voice}
        />
        <BudgetSettings draft={draft} locale={locale} updateBudget={controls.updateBudget} />
      </div>
    </details>
  );
}
