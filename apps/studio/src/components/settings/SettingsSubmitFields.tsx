import { Input } from "@/components/ui/input";
import type { StudioSettingsCopy } from "./settingsCopy";
import { Field } from "./settingsFormPrimitives";

export function SettingsSubmitFields({
  copy,
  editor,
  note,
  onEditorChange,
  onNoteChange,
}: Readonly<{
  copy: StudioSettingsCopy;
  editor: string;
  note: string;
  onEditorChange: (value: string) => void;
  onNoteChange: (value: string) => void;
}>) {
  return (
    <div className='grid gap-4 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)]'>
      <Field label={copy.editor}>
        <Input value={editor} onChange={(event) => onEditorChange(event.target.value)} />
      </Field>
      <Field label={copy.note}>
        <Input
          placeholder={copy.note}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </Field>
    </div>
  );
}
