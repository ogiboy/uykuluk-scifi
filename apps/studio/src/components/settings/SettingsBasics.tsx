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
import { Field } from "./settingsFormPrimitives";
import type { DraftUpdater } from "./settingsTypes";

export function SettingsBasics({
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
  const updateStudio = <K extends keyof ProducerConfig["studio"]>(
    key: K,
    value: ProducerConfig["studio"][K],
  ) => updateDraft((current) => ({ ...current, studio: { ...current.studio, [key]: value } }));
  const labels =
    locale === "tr"
      ? { dark: "Koyu", light: "Açık", port: "Studio portu", system: "Sistem" }
      : { dark: "Dark", light: "Light", port: "Studio port", system: "System" };

  return (
    <div className='grid gap-4 sm:grid-cols-3'>
      <Field controlId='settings-locale' label={copy.locale}>
        <Select
          value={draft.studio.locale}
          onValueChange={(value) => updateStudio("locale", value as StudioLocale)}
        >
          <SelectTrigger className='w-full' id='settings-locale'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='tr'>{copy.turkish}</SelectItem>
            <SelectItem value='en'>{copy.english}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field controlId='settings-theme' label={copy.theme}>
        <Select
          value={draft.studio.theme}
          onValueChange={(value) =>
            updateStudio("theme", value as ProducerConfig["studio"]["theme"])
          }
        >
          <SelectTrigger className='w-full' id='settings-theme'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='system'>{labels.system}</SelectItem>
            <SelectItem value='dark'>{labels.dark}</SelectItem>
            <SelectItem value='light'>{labels.light}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field controlId='settings-port' label={labels.port}>
        <Input
          id='settings-port'
          inputMode='numeric'
          min={1024}
          max={65535}
          type='number'
          value={draft.studio.port}
          onChange={(event) => updateStudio("port", Number(event.target.value))}
        />
        <p className='text-muted-foreground text-xs'>{copy.restartRequired}</p>
      </Field>
    </div>
  );
}
