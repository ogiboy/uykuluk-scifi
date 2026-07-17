import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioGuardedActionSubmitState } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type { ProviderSmokeEvidence } from "../../../../../src/stages/providers/providerSmokeEvidence";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import { Field } from "./settingsFormPrimitives";
import {
  checkingLabel,
  diagnosticDescription,
  diagnosticRunLabel,
  diagnosticStatusLabel,
  diagnosticTextLabel,
  diagnosticTitle,
  latestDiagnosticLabel,
  missingServerKeyCopy,
  remainingCreditsLabel,
  voiceIdLabel,
  voiceIdPlaceholder,
} from "./settingsLabels";

const unavailableDiagnosticTranscript =
  "data:text/vtt;charset=utf-8,WEBVTT%0A%0A00%3A00.000%20--%3E%2023%3A59%3A59.999%0ADiagnostic%20recording.%20A%20transcript%20is%20unavailable.";

export function ElevenLabsDiagnosticCard({
  evidence,
  locale,
  onRun,
  onTextChange,
  onVoiceIdChange,
  secretConfigured,
  state,
  text,
  voiceId,
}: Readonly<{
  evidence: (ProviderSmokeEvidence & { audioUrl: string | null }) | null;
  locale: StudioLocale;
  onRun: () => void;
  onTextChange: (value: string) => void;
  onVoiceIdChange: (value: string) => void;
  secretConfigured: boolean;
  state: StudioGuardedActionSubmitState;
  text: string;
  voiceId: string;
}>) {
  const running = state.kind === "submitting";
  const disabled = !secretConfigured || !voiceId.trim() || !text.trim() || running;
  const copy =
    locale === "tr"
      ? {
          description: "ElevenLabs bağlantısını ve dahil krediyi açık bir testle doğrulayın.",
          title: "Sağlayıcı tanıları",
        }
      : {
          description: "Verify ElevenLabs connectivity and included credits with an explicit test.",
          title: "Provider diagnostics",
        };

  return (
    <details
      className='bg-card/50 rounded-2xl shadow-sm shadow-black/5'
      data-testid='provider-diagnostics'
    >
      <summary className='cursor-pointer px-6 py-5'>
        <span className='block font-semibold'>{copy.title}</span>
        <span className='text-muted-foreground mt-1 block text-sm'>{copy.description}</span>
      </summary>
      <div className='grid gap-5 border-t border-(--line) px-6 py-6'>
        <header className='grid gap-2'>
          <h2 className='font-semibold'>{diagnosticTitle(locale)}</h2>
          <p className='text-muted-foreground text-sm'>{diagnosticDescription(locale)}</p>
        </header>
        <div className='grid gap-4 md:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]'>
          <Field label={voiceIdLabel(locale)}>
            <Input
              autoComplete='off'
              placeholder={voiceIdPlaceholder(locale)}
              value={voiceId}
              onChange={(event) => onVoiceIdChange(event.target.value)}
            />
          </Field>
          <Field label={diagnosticTextLabel(locale)}>
            <Textarea
              maxLength={180}
              rows={3}
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
            />
            <p className='text-muted-foreground text-xs'>{text.length}/180</p>
          </Field>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Button disabled={disabled} type='button' variant='secondary' onClick={onRun}>
            {running ? checkingLabel(locale) : diagnosticRunLabel(locale)}
          </Button>
          {!secretConfigured ? (
            <span className='text-muted-foreground text-xs'>{missingServerKeyCopy(locale)}</span>
          ) : null}
        </div>
        <MutationResult state={state} />
        <DiagnosticEvidence evidence={evidence} locale={locale} />
      </div>
    </details>
  );
}

function DiagnosticEvidence({
  evidence,
  locale,
}: Readonly<{
  evidence: (ProviderSmokeEvidence & { audioUrl: string | null }) | null;
  locale: StudioLocale;
}>) {
  if (!evidence) return null;
  const message = diagnosticEvidenceMessage(evidence, locale);
  return (
    <div className='bg-muted/20 grid gap-3 rounded-xl border border-(--line) p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <strong>{latestDiagnosticLabel(locale)}</strong>
        <Badge variant={evidence.status === "succeeded" ? "secondary" : "outline"}>
          {diagnosticStatusLabel(evidence.status, locale)}
        </Badge>
      </div>
      <p className='text-muted-foreground text-sm'>
        {new Date(evidence.completedAt).toLocaleString(locale)} · {evidence.modelId}
      </p>
      {message}
      {evidence.entitlement ? (
        <p className='text-muted-foreground text-xs'>
          {remainingCreditsLabel(locale)}: {evidence.entitlement.remainingCredits} /{" "}
          {evidence.entitlement.expectedCredits}
        </p>
      ) : null}
    </div>
  );
}

function diagnosticEvidenceMessage(
  evidence: ProviderSmokeEvidence & { audioUrl: string | null },
  locale: StudioLocale,
) {
  if (evidence.status === "succeeded" && evidence.audioUrl) {
    return <DiagnosticAudio audioUrl={evidence.audioUrl} locale={locale} />;
  }
  if ("message" in evidence) return <p className='text-sm'>{evidence.message}</p>;
  return null;
}

function DiagnosticAudio({
  audioUrl,
  locale,
}: Readonly<{ audioUrl: string; locale: StudioLocale }>) {
  const label = locale === "tr" ? "ElevenLabs tanı kaydı" : "ElevenLabs diagnostic recording";
  const trackLabel = locale === "tr" ? "Metin durumu" : "Transcript status";
  return (
    <audio aria-label={label} className='w-full' controls preload='metadata' src={audioUrl}>
      <track
        kind='captions'
        label={trackLabel}
        src={unavailableDiagnosticTranscript}
        srcLang='en'
      />
    </audio>
  );
}

function MutationResult({ state }: Readonly<{ state: StudioGuardedActionSubmitState }>) {
  return state.kind === "idle" ? null : <StudioMutationResultPanel state={state} />;
}
