import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioGuardedActionSubmitState } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type { PromptProfile } from "../../../../../src/prompts/profiles/promptProfileStore";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import type { StudioSettingsCopy } from "./settingsCopy";
import { Field } from "./settingsFormPrimitives";
import { profileBriefRequiredCopy, savingLabel } from "./settingsLabels";
import { SettingsSubmitFields } from "./SettingsSubmitFields";

export function PromptProfileCard({
  activeProfile,
  copy,
  editor,
  locale,
  note,
  onEditorChange,
  onNoteChange,
  onProfileChange,
  onPromptChange,
  onSave,
  profileId,
  profiles,
  prompt,
  state,
}: Readonly<{
  activeProfile: PromptProfile;
  copy: StudioSettingsCopy;
  editor: string;
  locale: StudioLocale;
  note: string;
  onEditorChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onProfileChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onSave: () => void;
  profileId: string;
  profiles: readonly PromptProfile[];
  prompt: string;
  state: StudioGuardedActionSubmitState;
}>) {
  const saving = state.kind === "submitting";
  const disabled = !prompt.trim() || !editor.trim() || !note.trim() || saving;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.profile}</CardTitle>
        <CardDescription>{copy.briefDescription}</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-5'>
        <Field label={copy.profile}>
          <Select value={profileId} onValueChange={onProfileChange}>
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.labels[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={copy.generationPrompt}>
          <Textarea
            value={prompt}
            rows={6}
            onChange={(event) => onPromptChange(event.target.value)}
          />
        </Field>
        {activeProfile.requiresOperatorBrief ? (
          <p className='rounded-lg border border-(--accent)/30 bg-(--accent)/10 p-3 text-sm'>
            {profileBriefRequiredCopy(locale)}
          </p>
        ) : null}
        <SettingsSubmitFields
          copy={copy}
          editor={editor}
          note={note}
          onEditorChange={onEditorChange}
          onNoteChange={onNoteChange}
        />
        <div className='flex flex-wrap items-center gap-3'>
          <Button disabled={disabled} type='button' variant='secondary' onClick={onSave}>
            {saving ? savingLabel(locale) : copy.saveProfile}
          </Button>
        </div>
        {state.kind === "idle" ? null : <StudioMutationResultPanel state={state} />}
      </CardContent>
    </Card>
  );
}
