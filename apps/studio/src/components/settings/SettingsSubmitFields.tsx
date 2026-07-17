import { Input } from "@/components/ui/input";
import type { StudioSettingsCopy } from "./settingsCopy";
import { Field } from "./settingsFormPrimitives";

export function SettingsSubmitFields({
  copy,
  editor,
  idPrefix,
  note,
  onEditorChange,
  onNoteChange,
}: Readonly<{
  copy: StudioSettingsCopy;
  editor: string;
  idPrefix: string;
  note: string;
  onEditorChange: (value: string) => void;
  onNoteChange: (value: string) => void;
}>) {
  return (
    <div className='grid gap-4 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)]'>
      <Field controlId={`${idPrefix}-editor`} label={copy.editor}>
        <Input
          id={`${idPrefix}-editor`}
          value={editor}
          onChange={(event) => onEditorChange(event.target.value)}
        />
      </Field>
      <Field controlId={`${idPrefix}-note`} label={copy.note}>
        <Input
          id={`${idPrefix}-note`}
          placeholder={copy.note}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </Field>
    </div>
  );
}
