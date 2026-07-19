import type { StudioLocale } from "../../../i18n/locales";

export type LocalVisualGenerationCopy = {
  readonly action: (count: number) => string;
  readonly blocked: string;
  readonly configUnavailable: string;
  readonly disabled: string;
  readonly fallbackError: string;
  readonly notReady: string;
  readonly readyHint: string;
  readonly readinessUnavailable: string;
  readonly routeUnavailable: string;
  readonly submitting: (count: number) => string;
  readonly success: string;
  readonly successTitle: string;
  readonly wrongMode: string;
};

type LocalVisualStatus = Readonly<{
  enabled: boolean;
  message: string;
  mode: string;
  readiness: string;
}>;

export function localVisualGenerationCopy(locale: StudioLocale): LocalVisualGenerationCopy {
  return locale === "tr" ? turkishCopy : englishCopy;
}

export function localVisualGenerationBlocker(
  locale: StudioLocale,
  local: LocalVisualStatus,
): string {
  const copy = localVisualGenerationCopy(locale);
  if (local.mode === "unknown") return copy.configUnavailable;
  if (local.readiness === "unknown") return copy.readinessUnavailable;
  if (!local.enabled) return copy.disabled;
  if (local.mode !== "mflux-local") return copy.wrongMode;
  if (local.readiness !== "ready") return copy.notReady;
  return copy.routeUnavailable;
}

const turkishCopy: LocalVisualGenerationCopy = {
  action: (count) => `Yerelde üret (${count})`,
  blocked: "Yerel görsel üretimi engellendi",
  configUnavailable:
    "Görsel üretim ayarları okunamadı. Yerel üretimden önce Ayarlar bölümünü inceleyin.",
  disabled: "Yerel üretim için Ayarlar'da MFLUX görsel üretimini etkinleştirin.",
  fallbackError: "Studio seçilen yerel görsel revizyonlarını üretemedi.",
  notReady:
    "Yerel üretim için MFLUX'u Ayarlar > Yerel Modeller bölümünden hazırlayın veya kurtarın.",
  readyHint:
    "Yalnız hazır MFLUX çalışma zamanını kullanır. Bu işlem model indirme veya kurulum başlatmaz.",
  readinessUnavailable:
    "Yerel model hazırlık durumu okunamadı. Devam etmeden önce Ayarlar > Yerel Modeller bölümünü inceleyin.",
  routeUnavailable: "Yerel üretim şu anda kullanılamıyor. Sayfayı yenileyip tekrar deneyin.",
  submitting: (count) => `${count} yerel görsel revizyonu sırayla üretiliyor...`,
  success: "Yerel görsel revizyonları incelemeye hazır.",
  successTitle: "Yerel görseller üretildi",
  wrongMode: "Yerel üretim için Ayarlar'da görsel üretim modunu Yerel MFLUX olarak seçin.",
};

const englishCopy: LocalVisualGenerationCopy = {
  action: (count) => `Generate locally (${count})`,
  blocked: "Local visual generation blocked",
  configUnavailable:
    "Image-generation settings could not be read. Review Settings before local generation.",
  disabled: "Enable MFLUX local image generation in Settings before generating locally.",
  fallbackError: "Studio could not generate the selected local visual revisions.",
  notReady: "Prepare or recover MFLUX in Settings > Local Models before generating locally.",
  readyHint:
    "Uses only the ready MFLUX runtime. This action never downloads a model or starts setup.",
  readinessUnavailable:
    "Local-model readiness could not be read. Review Settings > Local Models before continuing.",
  routeUnavailable: "Local generation is currently unavailable. Refresh and try again.",
  submitting: (count) => `Generating ${count} local visual revision(s) sequentially...`,
  success: "Local visual revisions are ready for review.",
  successTitle: "Local visuals generated",
  wrongMode: "Select MFLUX local image generation in Settings before generating locally.",
};
