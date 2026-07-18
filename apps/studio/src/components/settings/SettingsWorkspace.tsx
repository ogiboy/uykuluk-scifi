"use client";

import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import { useMemo, useState } from "react";
import type { PromptProfileId } from "../../../../../src/prompts/profiles/promptProfileStore";
import {
  persistAppearancePreference,
  readStoredPreference,
  readStoredPreferenceText,
  studioLocaleCookie,
} from "../studio/studioAppearancePreferences";
import { ElevenLabsDiagnosticCard } from "./ElevenLabsDiagnosticCard";
import { PromptProfileCard } from "./PromptProfileCard";
import { SettingsConfigurationCard } from "./SettingsConfigurationCard";
import { settingsCopy } from "./settingsCopy";
import { diagnosticDefaultText, diagnosticPreflightCopy } from "./settingsLabels";
import { SettingsOverview } from "./SettingsOverview";
import { profileSubmitInput, settingsSubmitInput, smokeSubmitInput } from "./settingsSubmitInput";
import type { SettingsWorkspaceProps } from "./settingsTypes";

export type { StudioSettingsRevisionSummary } from "./settingsTypes";

/** Provides a revision-aware settings surface for the next producer operation. */
export function SettingsWorkspace({
  config,
  currentDigest,
  latestElevenLabsSmoke,
  locale,
  profileDigests,
  revisions,
  secretStatus,
}: SettingsWorkspaceProps) {
  const copy = settingsCopy(locale);
  const [draft, setDraft] = useState(config);
  const [editor, setEditor] = useState(locale === "tr" ? "Studio operatörü" : "Studio operator");
  const [note, setNote] = useState("");
  const [profileId, setProfileId] = useState(config.editorial.activeProfileId);
  const [profilePrompt, setProfilePrompt] = useState(
    selectedProfile(config.editorial.profiles, config.editorial.activeProfileId).generationPrompt,
  );
  const [profileNote, setProfileNote] = useState("");
  const [smokeVoiceId, setSmokeVoiceId] = useState("");
  const [smokeText, setSmokeText] = useState(diagnosticDefaultText(locale));
  const settingsAction = useStudioGuardedActionSubmit(copy.applyNextOperation);
  const profileAction = useStudioGuardedActionSubmit(copy.briefDescription);
  const smokeAction = useStudioGuardedActionSubmit(diagnosticPreflightCopy(locale));
  const activeProfile = useMemo(
    () => selectedProfile(draft.editorial.profiles, profileId),
    [draft.editorial.profiles, profileId],
  );

  const updateProfile = (id: string) => {
    const nextProfile = selectedProfile(draft.editorial.profiles, id);
    setProfileId(id as PromptProfileId);
    setProfilePrompt(nextProfile.generationPrompt);
  };

  const saveSettings = async () => {
    const result = await settingsAction.submit(
      settingsSubmitInput({ currentDigest, draft, editor, locale, note }),
    );
    if (result.kind !== "success") return;
    applySavedAppearance(draft, locale);
  };

  return (
    <div className='grid gap-6 pb-10'>
      <SettingsOverview
        copy={copy}
        locale={locale}
        revisions={revisions}
        secretStatus={secretStatus}
        settingsRevision={config.settingsRevision}
      />
      <SettingsConfigurationCard
        copy={copy}
        draft={draft}
        editor={editor}
        locale={locale}
        note={note}
        state={settingsAction.state}
        updateDraft={setDraft}
        onEditorChange={setEditor}
        onNoteChange={setNote}
        onSave={() => void saveSettings()}
      />
      <ElevenLabsDiagnosticCard
        evidence={latestElevenLabsSmoke}
        locale={locale}
        secretConfigured={secretStatus.elevenLabs}
        state={smokeAction.state}
        text={smokeText}
        voiceId={smokeVoiceId}
        onTextChange={setSmokeText}
        onVoiceIdChange={setSmokeVoiceId}
        onRun={() =>
          void smokeAction.submit(
            smokeSubmitInput({ locale, text: smokeText.trim(), voiceId: smokeVoiceId.trim() }),
          )
        }
      />
      <PromptProfileCard
        activeProfile={activeProfile}
        copy={copy}
        editor={editor}
        locale={locale}
        note={profileNote}
        profileId={profileId}
        profiles={draft.editorial.profiles}
        prompt={profilePrompt}
        state={profileAction.state}
        onEditorChange={setEditor}
        onNoteChange={setProfileNote}
        onProfileChange={updateProfile}
        onPromptChange={setProfilePrompt}
        onSave={() =>
          void profileAction.submit(
            profileSubmitInput({
              activeProfile,
              currentDigest,
              draft,
              editor,
              locale,
              profileDigests,
              profileNote,
              profilePrompt,
            }),
          )
        }
      />
    </div>
  );
}

function selectedProfile(
  profiles: SettingsWorkspaceProps["config"]["editorial"]["profiles"],
  id: string,
) {
  const profile = profiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Configured prompt profile is missing: ${id}`);
  return profile;
}

function applySavedAppearance(
  draft: SettingsWorkspaceProps["config"],
  locale: SettingsWorkspaceProps["locale"],
) {
  const appearance = readStoredPreference(locale, readStoredPreferenceText());
  persistAppearancePreference({
    ...appearance,
    locale: draft.studio.locale,
    theme: draft.studio.theme,
  });
  document.cookie = studioLocaleCookie(draft.studio.locale);
  document.documentElement.lang = draft.studio.locale;
  if (draft.studio.locale !== locale) globalThis.location.reload();
}
