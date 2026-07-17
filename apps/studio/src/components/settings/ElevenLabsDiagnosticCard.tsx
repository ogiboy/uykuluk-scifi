import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioGuardedActionSubmitState } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type {
  ProviderSmokeErrorCategory,
  ProviderSmokeEvidence,
} from "../../../../../src/stages/providers/providerSmokeEvidence";
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
          <Field controlId='elevenlabs-diagnostic-voice-id' label={voiceIdLabel(locale)}>
            <Input
              autoComplete='off'
              id='elevenlabs-diagnostic-voice-id'
              placeholder={voiceIdPlaceholder(locale)}
              value={voiceId}
              onChange={(event) => onVoiceIdChange(event.target.value)}
            />
          </Field>
          <Field controlId='elevenlabs-diagnostic-text' label={diagnosticTextLabel(locale)}>
            <Textarea
              id='elevenlabs-diagnostic-text'
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
  if ("reason" in evidence) {
    const category =
      "providerErrorCategory" in evidence ? evidence.providerErrorCategory : undefined;
    return <p className='text-sm'>{diagnosticFailureCopy(evidence.reason, category, locale)}</p>;
  }
  return null;
}

function DiagnosticAudio({
  audioUrl,
  locale,
}: Readonly<{ audioUrl: string; locale: StudioLocale }>) {
  const label = locale === "tr" ? "ElevenLabs tanı kaydı" : "ElevenLabs diagnostic recording";
  const unavailableCopy =
    locale === "tr"
      ? "Bu tanı kaydı için konuşma metni mevcut değil."
      : "A transcript is not available for this diagnostic recording.";
  return (
    <div className='grid gap-2'>
      <audio aria-label={label} className='w-full' controls preload='metadata' src={audioUrl} />
      <p className='text-muted-foreground text-xs'>{unavailableCopy}</p>
    </div>
  );
}

function diagnosticFailureCopy(
  reason: Extract<ProviderSmokeEvidence, { status: "blocked" | "failed" | "unknown" }>["reason"],
  category: ProviderSmokeErrorCategory | undefined,
  locale: StudioLocale,
) {
  const reasons =
    locale === "tr"
      ? {
          configuration: "Yapılandırma eksik veya geçersiz.",
          entitlement: "Dahil kredi veya kullanım hakkı doğrulanamadı.",
          "provider-rejected": "Sağlayıcı isteği reddetti.",
          "provider-timeout": "Sağlayıcı yanıtı zaman aşımına uğradı.",
          "response-invalid": "Sağlayıcı yanıtı doğrulanamadı.",
          "in-progress": "Tanı işlemi hâlâ sürüyor.",
        }
      : {
          configuration: "Configuration is missing or invalid.",
          entitlement: "Included credits or entitlement could not be verified.",
          "provider-rejected": "The provider rejected the request.",
          "provider-timeout": "The provider response timed out.",
          "response-invalid": "The provider response could not be verified.",
          "in-progress": "The diagnostic is still in progress.",
        };
  if (!category) return reasons[reason];
  const categories =
    locale === "tr"
      ? {
          authentication: "Kimlik doğrulama",
          "access-denied": "Erişim reddedildi",
          "invalid-request": "Geçersiz istek",
          "rate-limited": "İstek sınırı",
          "provider-unavailable": "Sağlayıcı kullanılamıyor",
          timeout: "Zaman aşımı",
        }
      : {
          authentication: "Authentication",
          "access-denied": "Access denied",
          "invalid-request": "Invalid request",
          "rate-limited": "Rate limited",
          "provider-unavailable": "Provider unavailable",
          timeout: "Timeout",
        };
  return `${reasons[reason]} ${categories[category]}.`;
}

function MutationResult({ state }: Readonly<{ state: StudioGuardedActionSubmitState }>) {
  return state.kind === "idle" ? null : <StudioMutationResultPanel state={state} />;
}
