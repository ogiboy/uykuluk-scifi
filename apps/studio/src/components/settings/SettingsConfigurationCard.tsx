import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioGuardedActionSubmitState } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type { ProducerConfig } from "../../../../../src/config/schema";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import { SettingsAdvanced } from "./SettingsAdvanced";
import { SettingsBasics } from "./SettingsBasics";
import type { StudioSettingsCopy } from "./settingsCopy";
import { savingLabel } from "./settingsLabels";
import { SettingsSubmitFields } from "./SettingsSubmitFields";
import type { DraftUpdater } from "./settingsTypes";

export function SettingsConfigurationCard({
  copy,
  draft,
  editor,
  locale,
  note,
  onEditorChange,
  onNoteChange,
  onSave,
  state,
  updateDraft,
}: Readonly<{
  copy: StudioSettingsCopy;
  draft: ProducerConfig;
  editor: string;
  locale: StudioLocale;
  note: string;
  onEditorChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
  state: StudioGuardedActionSubmitState;
  updateDraft: DraftUpdater;
}>) {
  const saving = state.kind === "submitting";
  const disabled = !editor.trim() || !note.trim() || saving;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.settings}</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-6'>
        <SettingsBasics copy={copy} draft={draft} locale={locale} updateDraft={updateDraft} />
        <SettingsAdvanced copy={copy} draft={draft} locale={locale} updateDraft={updateDraft} />
        <SettingsSubmitFields
          copy={copy}
          editor={editor}
          note={note}
          onEditorChange={onEditorChange}
          onNoteChange={onNoteChange}
        />
        <div className='flex flex-wrap items-center gap-3'>
          <Button disabled={disabled} type='button' onClick={onSave}>
            {saving ? savingLabel(locale) : copy.saveSettings}
          </Button>
        </div>
        {state.kind === "idle" ? null : <StudioMutationResultPanel state={state} />}
      </CardContent>
    </Card>
  );
}
