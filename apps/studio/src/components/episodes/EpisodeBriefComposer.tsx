"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { StudioLocale } from "@/i18n/locales";
import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import { useMemo, useState } from "react";
import type {
  PromptProfile,
  PromptProfileId,
} from "../../../../../src/prompts/profiles/promptProfileStore";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import { episodeBriefCopy } from "./episodeBriefCopy";

type EpisodeBriefComposerProps = Readonly<{
  currentSettingsDigest: string;
  locale: StudioLocale;
  profileDigests: Readonly<Record<string, string>>;
  profiles: readonly PromptProfile[];
}>;

/**
 * Starts idea generation with a visible profile and optional operator brief. The canonical core
 * persists the submitted profile and settings snapshots before it invokes an idea provider.
 */
export function EpisodeBriefComposer({
  currentSettingsDigest,
  locale,
  profileDigests,
  profiles,
}: EpisodeBriefComposerProps) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "sci-fi");
  const [operatorBrief, setOperatorBrief] = useState("");
  const profile = useMemo(
    () => profiles.find((candidate) => candidate.id === profileId) ?? profiles[0],
    [profileId, profiles],
  );
  const requiresBrief = profile?.requiresOperatorBrief ?? false;
  const copy = episodeBriefCopy(locale, requiresBrief);
  const { state, submit } = useStudioGuardedActionSubmit(copy.idleMessage);
  if (!profile) return null;
  const canCreate = !requiresBrief || operatorBrief.trim().length > 0;
  const buttonLabel = state.kind === "submitting" ? copy.creatingIdeas : copy.createIdeas;
  const mutationResult = state.kind === "idle" ? null : <StudioMutationResultPanel state={state} />;

  async function createEpisode(): Promise<void> {
    await submit({
      actionId: "episodes.create",
      body: {
        expectedProfileDigest: profileDigests[profile.id],
        expectedSettingsDigest: currentSettingsDigest,
        operatorBrief: operatorBrief.trim() || undefined,
        profileId,
      },
      errorToastTitle: copy.errorToastTitle,
      fallbackError: copy.fallbackError,
      routePath: "/actions/episode-create",
      submittingMessage: copy.submittingMessage,
      successMessage: copy.successMessage,
      successToastTitle: copy.successToastTitle,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle aria-level={2} role='heading'>
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-5'>
        <div className='grid gap-2'>
          <Label htmlFor='episode-profile'>{copy.directionLabel}</Label>
          <Select
            value={profileId}
            onValueChange={(value) => setProfileId(value as PromptProfileId)}
          >
            <SelectTrigger className='w-full' id='episode-profile'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.labels[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='bg-muted/15 rounded-xl border border-(--line) p-4 text-sm'>
          <strong className='mb-2 block'>{copy.directionTitle}</strong>
          <p className='text-muted-foreground whitespace-pre-wrap'>{profile.generationPrompt}</p>
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='operator-brief'>{copy.optionalBriefLabel}</Label>
          <Textarea
            id='operator-brief'
            placeholder={copy.optionalBriefPlaceholder}
            rows={6}
            value={operatorBrief}
            onChange={(event) => setOperatorBrief(event.target.value)}
          />
          <p className='text-muted-foreground text-xs'>{copy.optionalBriefHelp}</p>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Button
            disabled={!canCreate || state.kind === "submitting"}
            type='button'
            onClick={() => void createEpisode()}
          >
            {buttonLabel}
          </Button>
          <span className='text-muted-foreground text-[0.6875rem] leading-relaxed opacity-80 sm:text-xs'>
            {copy.snapshotNotice}
          </span>
        </div>
        {mutationResult}
      </CardContent>
    </Card>
  );
}
