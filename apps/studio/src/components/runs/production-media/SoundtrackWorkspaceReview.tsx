"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StudioLocale } from "@/i18n/locales";
import type {
  StudioSoundtrackActionBinding,
  StudioSoundtrackSummary,
} from "@/lib/runs/soundtrackSummaries";
import { useState } from "react";

export type SoundtrackExpectedBinding = Readonly<{
  expectedManifestDigest: string;
  expectedRevision: number;
}>;

export type SoundtrackRunAction = (
  action: StudioSoundtrackActionBinding | null,
  body: unknown,
  title: string,
  success: string,
) => Promise<void>;

export type SoundtrackWorkspaceCopy = Readonly<{
  advanced: string;
  assetId: string;
  analyze: string;
  analyzeBlocked: string;
  analyzeSuccess: string;
  analysis: string;
  analysisComplete: string;
  analysisPending: string;
  approve: string;
  assets: string;
  clearMusic: string;
  configure: string;
  configureBlocked: string;
  configureHint: string;
  configureSuccess: string;
  decision: string;
  digest: string;
  imported: string;
  import: string;
  importBlocked: string;
  importFile: string;
  importHint: string;
  importReadError: string;
  importSuccess: string;
  importValidation: string;
  invalid: string;
  mix: string;
  mixSettings: string;
  music: string;
  musicAsset: string;
  musicFadeIn: string;
  musicFadeOut: string;
  musicGain: string;
  musicTrim: string;
  nextAction: string;
  noAssets: string;
  notes: string;
  noNewSfx: string;
  panelDescription: string;
  panelTitle: string;
  prepare: string;
  prepareBlocked: string;
  prepareSuccess: string;
  reject: string;
  reviewer: string;
  revision: string;
  rights: string;
  rightsBasis: string;
  rightsEvidence: string;
  role: string;
  sfxCues: string;
  sfxCueId: string;
  sfxDuration: string;
  sfxFadeIn: string;
  sfxFadeOut: string;
  sfxGain: string;
  sfxStart: string;
  sfxCueValidation: string;
  status: (kind: "invalid" | "missing" | "ready", mode: "mixed" | "voice-only" | null) => string;
  decisionStatus: (status: "approved" | "rejected" | null) => string;
  submitBlocked: string;
  submitSuccess: string;
  voiceOnly: string;
}>;

type SoundtrackReviewSectionsProps = Readonly<{
  busy: boolean;
  copy: SoundtrackWorkspaceCopy;
  expected: SoundtrackExpectedBinding;
  runAction: SoundtrackRunAction;
  runId: string;
  summary: StudioSoundtrackSummary;
}>;

export function SoundtrackReviewSections({
  busy,
  copy,
  expected,
  runAction,
  runId,
  summary,
}: SoundtrackReviewSectionsProps) {
  const [reviewedBy, setReviewedBy] = useState("");
  const [notes, setNotes] = useState("");
  const decisionAction = summary.actions["soundtrack.decide"];
  const decisionDisabled = busy || !reviewedBy.trim() || !notes.trim() || !decisionAction;

  const decide = (status: "approved" | "rejected") =>
    runAction(
      decisionAction,
      { runId, ...expected, notes: notes.trim(), reviewedBy: reviewedBy.trim(), status },
      copy.submitBlocked,
      copy.submitSuccess,
    );

  return (
    <>
      <section className='grid gap-3 rounded-lg border border-(--line) p-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h3 className='font-semibold'>{copy.analysis}</h3>
          <Badge variant={summary.analysis ? "secondary" : "outline"}>
            {summary.analysis ? copy.analysisComplete : copy.analysisPending}
          </Badge>
        </div>
        {summary.analysis ? (
          <p className='text-muted-foreground text-sm'>{summary.analysis.measuredAt}</p>
        ) : null}
        <Button
          disabled={busy || !summary.actions["soundtrack.analyze"]}
          onClick={() =>
            void runAction(
              summary.actions["soundtrack.analyze"],
              { runId, ...expected },
              copy.analyzeBlocked,
              copy.analyzeSuccess,
            )
          }
        >
          {copy.analyze}
        </Button>
      </section>
      <section className='grid gap-3 rounded-lg border border-(--line) p-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h3 className='font-semibold'>{copy.decision}</h3>
          <Badge variant={summary.decision?.status === "rejected" ? "destructive" : "outline"}>
            {copy.decisionStatus(summary.decision?.status ?? null)}
          </Badge>
        </div>
        {summary.decision ? (
          <p className='text-muted-foreground text-sm'>
            {summary.decision.reviewedBy}: {summary.decision.notes}
          </p>
        ) : (
          <>
            <Label htmlFor='soundtrack-reviewer'>{copy.reviewer}</Label>
            <Input
              id='soundtrack-reviewer'
              value={reviewedBy}
              onChange={(event) => setReviewedBy(event.target.value)}
            />
            <Label htmlFor='soundtrack-notes'>{copy.notes}</Label>
            <Textarea
              id='soundtrack-notes'
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <div className='flex flex-wrap gap-2'>
              <Button
                disabled={decisionDisabled || !summary.analysis}
                onClick={() => void decide("approved")}
              >
                {copy.approve}
              </Button>
              <Button
                disabled={decisionDisabled}
                onClick={() => void decide("rejected")}
                variant='outline'
              >
                {copy.reject}
              </Button>
            </div>
          </>
        )}
      </section>
      <section className='grid gap-3'>
        <h3 className='font-semibold'>{copy.assets}</h3>
        {summary.assets.length === 0 ? (
          <p className='text-muted-foreground text-sm'>{copy.noAssets}</p>
        ) : (
          <div className='grid gap-3 md:grid-cols-2'>
            {summary.assets.map((asset) => (
              <article
                className='grid gap-2 rounded-lg border border-(--line) p-3 text-sm'
                key={asset.assetId}
              >
                <div className='flex justify-between gap-2'>
                  <strong>{asset.assetId}</strong>
                  <Badge variant='outline'>{asset.role}</Badge>
                </div>
                <p>
                  {copy.imported}: {asset.originalFileName}
                </p>
                <p>
                  {copy.rights}: {asset.rights.basis} — {asset.rights.attestedBy}
                </p>
                <p className='text-muted-foreground'>{asset.rights.evidence}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

const english: SoundtrackWorkspaceCopy = {
  advanced: "Advanced evidence",
  assetId: "Asset ID",
  analyze: "Run pass-1 analysis",
  analyzeBlocked: "Soundtrack analysis blocked",
  analyzeSuccess: "Pass-1 loudness analysis was recorded for this exact soundtrack revision.",
  analysis: "Pass-1 analysis",
  analysisComplete: "Complete",
  analysisPending: "Pending",
  approve: "Approve soundtrack",
  assets: "Imported music and SFX",
  clearMusic: "Voice-only (no music bed)",
  configure: "Save mix configuration",
  configureBlocked: "Soundtrack mix configuration blocked",
  configureHint:
    "Every save requires the displayed digest and revision. Changing a mix invalidates its prior analysis and decision.",
  configureSuccess: "The mix configuration was saved as a new soundtrack revision.",
  decision: "Review decision",
  digest: "Manifest digest",
  imported: "Imported",
  import: "Import audio asset",
  importBlocked: "Soundtrack import blocked",
  importFile: "Audio file",
  importHint:
    "Import one local WAV, MP3, M4A, OGG, or FLAC file with attributable rights evidence. Files stay inside this run.",
  importReadError: "The selected audio file could not be read.",
  importSuccess: "The audio asset was imported as a new soundtrack revision.",
  importValidation: "Choose an audio file and provide an asset ID, operator, and rights evidence.",
  invalid: "Soundtrack evidence needs attention",
  mix: "Current mix",
  mixSettings: "Music and SFX mix settings",
  music: "Music bed",
  musicAsset: "Music asset",
  musicFadeIn: "Fade in (seconds)",
  musicFadeOut: "Fade out (seconds)",
  musicGain: "Music gain (dB)",
  musicTrim: "Trim start (seconds)",
  nextAction: "Next action",
  noAssets: "No imported music or SFX. Voice-only fallback remains reviewable.",
  notes: "Review notes",
  noNewSfx: "Keep existing SFX cues",
  panelDescription:
    "Review the voice-only fallback or exact imported music/SFX mix. Analysis and decisions are bound to one persisted soundtrack revision.",
  panelTitle: "Soundtrack And Audio Mastering",
  prepare: "Prepare voice-only fallback",
  prepareBlocked: "Soundtrack preparation blocked",
  prepareSuccess: "Voice-only soundtrack evidence was prepared from the reviewed voice.",
  reject: "Reject soundtrack",
  reviewer: "Reviewer",
  revision: "Revision",
  rights: "Rights and provenance",
  rightsBasis: "Rights basis",
  rightsEvidence: "Rights evidence",
  role: "Role",
  sfxCues: "Timed SFX cues",
  sfxCueId: "Cue ID",
  sfxDuration: "Cue duration (seconds)",
  sfxFadeIn: "SFX fade in (seconds)",
  sfxFadeOut: "SFX fade out (seconds)",
  sfxGain: "SFX gain (dB)",
  sfxStart: "Cue start (seconds)",
  sfxCueValidation: "An SFX asset requires a unique cue ID.",
  status: (kind, mode) => {
    if (kind === "ready") return mode === "voice-only" ? "Voice-only fallback" : "Mixed soundtrack";
    if (kind === "missing") return "Not prepared";
    return "Evidence needs attention";
  },
  decisionStatus: (status) => {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return "No decision recorded";
  },
  submitBlocked: "Soundtrack decision blocked",
  submitSuccess:
    "The review decision was recorded against this exact soundtrack digest and revision.",
  voiceOnly: "Voice-only fallback",
};

const turkish: SoundtrackWorkspaceCopy = {
  advanced: "Gelişmiş kanıt",
  assetId: "Varlık kimliği",
  analyze: "İlk geçiş analizini çalıştır",
  analyzeBlocked: "Soundtrack analizi engellendi",
  analyzeSuccess: "İlk geçiş ses yüksekliği analizi bu tam soundtrack revizyonu için kaydedildi.",
  analysis: "İlk geçiş analizi",
  analysisComplete: "Tamamlandı",
  analysisPending: "Bekliyor",
  approve: "Soundtrack'i onayla",
  assets: "İçe aktarılan müzik ve SFX",
  clearMusic: "Yalnızca ses (müzik yatağı yok)",
  configure: "Miks ayarını kaydet",
  configureBlocked: "Soundtrack miks ayarı engellendi",
  configureHint:
    "Her kayıt gösterilen özet ve revizyonu gerektirir. Miks değişikliği önceki analiz ve kararı geçersizleştirir.",
  configureSuccess: "Miks ayarı yeni bir soundtrack revizyonu olarak kaydedildi.",
  decision: "İnceleme kararı",
  digest: "Manifest özeti",
  imported: "İçe aktarıldı",
  import: "Ses varlığı içe aktar",
  importBlocked: "Soundtrack içe aktarma engellendi",
  importFile: "Ses dosyası",
  importHint:
    "Atfedilebilir hak kanıtıyla bir yerel WAV, MP3, M4A, OGG veya FLAC dosyası içe aktarın. Dosyalar bu run içinde kalır.",
  importReadError: "Seçilen ses dosyası okunamadı.",
  importSuccess: "Ses varlığı yeni bir soundtrack revizyonu olarak içe aktarıldı.",
  importValidation: "Bir ses dosyası seçin; varlık kimliği, operatör ve hak kanıtını girin.",
  invalid: "Soundtrack kanıtı dikkat gerektiriyor",
  mix: "Geçerli miks",
  mixSettings: "Müzik ve SFX miks ayarları",
  music: "Müzik yatağı",
  musicAsset: "Müzik varlığı",
  musicFadeIn: "Giriş geçişi (saniye)",
  musicFadeOut: "Çıkış geçişi (saniye)",
  musicGain: "Müzik seviyesi (dB)",
  musicTrim: "Kırpma başlangıcı (saniye)",
  nextAction: "Sonraki adım",
  noAssets: "İçe aktarılan müzik veya SFX yok. Yalnızca ses fallback'i incelenebilir durumda.",
  notes: "İnceleme notları",
  noNewSfx: "Mevcut SFX işaretlerini koru",
  panelDescription:
    "Yalnızca ses fallback'ini veya tam içe aktarılan müzik/SFX miksini inceleyin. Analiz ve kararlar tek bir kalıcı soundtrack revizyonuna bağlıdır.",
  panelTitle: "Soundtrack ve Ses Mastering",
  prepare: "Yalnızca ses fallback'ini hazırla",
  prepareBlocked: "Soundtrack hazırlığı engellendi",
  prepareSuccess: "Yalnızca ses soundtrack kanıtı incelenen sesten hazırlandı.",
  reject: "Soundtrack'i reddet",
  reviewer: "İnceleyen",
  revision: "Revizyon",
  rights: "Haklar ve kaynak bilgisi",
  rightsBasis: "Hak dayanağı",
  rightsEvidence: "Hak kanıtı",
  role: "Rol",
  sfxCues: "Zamanlı SFX işaretleri",
  sfxCueId: "İşaret kimliği",
  sfxDuration: "İşaret süresi (saniye)",
  sfxFadeIn: "SFX giriş geçişi (saniye)",
  sfxFadeOut: "SFX çıkış geçişi (saniye)",
  sfxGain: "SFX seviyesi (dB)",
  sfxStart: "İşaret başlangıcı (saniye)",
  sfxCueValidation: "Bir SFX varlığı benzersiz bir işaret kimliği gerektirir.",
  status: (kind, mode) => {
    if (kind === "ready")
      return mode === "voice-only" ? "Yalnızca ses fallback'i" : "Miks soundtrack";
    if (kind === "missing") return "Hazırlanmadı";
    return "Kanıt dikkat gerektiriyor";
  },
  decisionStatus: (status) => {
    if (status === "approved") return "Onaylandı";
    if (status === "rejected") return "Reddedildi";
    return "Kayıtlı karar yok";
  },
  submitBlocked: "Soundtrack kararı engellendi",
  submitSuccess: "İnceleme kararı bu tam soundtrack özeti ve revizyonuna kaydedildi.",
  voiceOnly: "Yalnızca ses fallback'i",
};

export function soundtrackWorkspaceCopy(locale: StudioLocale): SoundtrackWorkspaceCopy {
  return locale === "tr" ? turkish : english;
}
