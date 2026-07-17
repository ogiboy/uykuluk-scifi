import type { StudioLocale } from "@/i18n/locales";
import type { ProviderSmokeEvidence } from "../../../../../src/stages/providers/providerSmokeEvidence";

export function diagnosticStatusLabel(
  status: ProviderSmokeEvidence["status"],
  locale: StudioLocale,
): string {
  if (locale === "en") return status;
  return {
    blocked: "Engellendi",
    failed: "Başarısız",
    succeeded: "Tamamlandı",
    unknown: "Bilinmiyor",
  }[status];
}

export function diagnosticDefaultText(locale: StudioLocale) {
  return locale === "tr"
    ? "Merhaba. Bu kısa kayıt, Türkçe ElevenLabs v3 ses ve zamanlama bağlantısını doğrular."
    : "Hello. This short recording verifies the ElevenLabs v3 voice and alignment connection.";
}

export function diagnosticPreflightCopy(locale: StudioLocale) {
  return locale === "tr"
    ? "İstekten önce canlı kota ve aşım durumu denetlenir."
    : "Live quota and overage state are checked before the request.";
}

export function savingLabel(locale: StudioLocale) {
  return locale === "tr" ? "Kaydediliyor..." : "Saving...";
}

export function checkingLabel(locale: StudioLocale) {
  return locale === "tr" ? "Denetleniyor..." : "Checking...";
}

export function diagnosticRunLabel(locale: StudioLocale) {
  return locale === "tr" ? "Tanıyı çalıştır" : "Run diagnostic";
}

export function diagnosticTitle(locale: StudioLocale) {
  return locale === "tr" ? "ElevenLabs bağlantı tanısı" : "ElevenLabs connectivity diagnostic";
}

export function diagnosticDescription(locale: StudioLocale) {
  return locale === "tr"
    ? "En fazla 180 karakterlik Eleven v3 kaydı üretir; bölümlerde kullanılamaz. Aşım etkinse veya yeterli dahil kredi kanıtlanamazsa istek gönderilmez."
    : "Creates an Eleven v3 sample of at most 180 characters; it cannot be used in episodes. No request is sent when overage is enabled or included credits cannot be proven.";
}

export function voiceIdLabel(locale: StudioLocale) {
  return locale === "tr" ? "Ses kimliği (Voice ID)" : "Voice ID";
}

export function voiceIdPlaceholder(locale: StudioLocale) {
  return locale === "tr" ? "ElevenLabs ses kimliği" : "ElevenLabs voice ID";
}

export function diagnosticTextLabel(locale: StudioLocale) {
  return locale === "tr" ? "Tanı metni" : "Diagnostic text";
}

export function missingServerKeyCopy(locale: StudioLocale) {
  return locale === "tr" ? "Sunucu anahtarı eksik." : "Server key is missing.";
}

export function latestDiagnosticLabel(locale: StudioLocale) {
  return locale === "tr" ? "Son tanı" : "Latest diagnostic";
}

export function remainingCreditsLabel(locale: StudioLocale) {
  return locale === "tr" ? "Kalan / gerekli kredi" : "Remaining / expected credits";
}

export function profileBriefRequiredCopy(locale: StudioLocale) {
  return locale === "tr"
    ? "Bu profil kullanılırken her bölüm için özel fikir metni gerekir."
    : "This profile requires a custom idea brief for every episode.";
}

export function disabledLabel(locale: StudioLocale) {
  return locale === "tr" ? "Kapalı" : "Disabled";
}

export function deterministicLabel(locale: StudioLocale) {
  return locale === "tr" ? "Deterministik yerel" : "Deterministic local";
}

export function staticManualLabel(locale: StudioLocale) {
  return locale === "tr" ? "Statik / manuel" : "Static / manual";
}

export function budgetLabel(
  locale: StudioLocale,
  kind: "episode" | "daily" | "weekly" | "approval",
) {
  const labels =
    locale === "tr"
      ? {
          episode: "Bölüm başına USD",
          daily: "Günlük USD",
          weekly: "Haftalık USD",
          approval: "Onay eşiği USD",
        }
      : {
          episode: "Per episode USD",
          daily: "Daily USD",
          weekly: "Weekly USD",
          approval: "Approval threshold USD",
        };
  return labels[kind];
}
