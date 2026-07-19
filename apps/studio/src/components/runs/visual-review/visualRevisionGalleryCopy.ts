import type { StudioLocale } from "../../../i18n/locales";

export type VisualRevisionGalleryCopy = {
  readonly canonical: string;
  readonly compareHint: string;
  readonly compareDescription: string;
  readonly dimensionsUnavailable: string;
  readonly manualImport: string;
  readonly mfluxLocal: string;
  readonly nextRevision: string;
  readonly previousRevision: string;
  readonly recordedRevision: string;
  readonly revision: (revision: number) => string;
  readonly reviewRevisions: (count: number) => string;
  readonly staticFallback: string;
  readonly title: (sceneIndex: number) => string;
  readonly useRevision: string;
};

/**
 * Selects the localized copy for the visual revision gallery.
 *
 * @param locale - The locale used to select the copy.
 * @returns Turkish copy for the `tr` locale; English copy for all other locales.
 */
export function visualRevisionGalleryCopy(locale: StudioLocale): VisualRevisionGalleryCopy {
  return locale === "tr" ? turkishCopy : englishCopy;
}

export function visualProviderLabel(locale: StudioLocale, providerId: string): string {
  const copy = visualRevisionGalleryCopy(locale);
  if (providerId === "static") return copy.staticFallback;
  if (providerId === "manual-import") return copy.manualImport;
  if (providerId === "black-forest-labs") return "Black Forest Labs";
  if (providerId === "mflux-local") return copy.mfluxLocal;
  return providerId;
}

type HostedVisualStatus = "approved" | "blocked" | "missing" | "pending" | "ready" | "settled";

export function hostedVisualStatusLabel(locale: StudioLocale, status: string): string {
  if (locale !== "tr") return status;
  const labels = {
    approved: "onaylandı",
    blocked: "engellendi",
    missing: "eksik",
    pending: "bekliyor",
    ready: "hazır",
    settled: "uzlaştırıldı",
  } satisfies Readonly<Record<HostedVisualStatus, string>>;
  return labels[status as HostedVisualStatus] ?? status;
}

export function hostedVisualPurposeLabel(
  locale: StudioLocale,
  purpose: "initial" | "regenerate-rejected" | null | undefined,
  fallback: string,
): string {
  if (!purpose) return fallback;
  if (locale !== "tr") return purpose;
  return purpose === "regenerate-rejected" ? "reddedilenleri yeniden üret" : "yeni üretim";
}

export function visualActionStatusLabel(
  locale: StudioLocale,
  kind: "blocked" | "error" | "idle" | "submitting" | "success",
): string {
  if (locale !== "tr") return kind;
  return {
    blocked: "engellendi",
    error: "hata",
    idle: "bekliyor",
    submitting: "gönderiliyor",
    success: "başarılı",
  }[kind];
}

const turkishCopy: VisualRevisionGalleryCopy = {
  canonical: "Kanonik",
  compareHint: "Revizyonları karşılaştırmak için sol ve sağ ok tuşlarını kullanın.",
  compareDescription:
    "Doğrulanmış adayları karşılaştırın. Kanonik revizyon, güncel render kararına bağlanan adaydır.",
  dimensionsUnavailable: "Boyut bilgisi yok",
  manualImport: "Manuel içe aktarma",
  mfluxLocal: "Yerel MFLUX",
  nextRevision: "Sonraki revizyonu göster",
  previousRevision: "Önceki revizyonu göster",
  recordedRevision: "Kaydedilen revizyon",
  revision: (revision) => `Revizyon ${revision}`,
  reviewRevisions: (count) => `Revizyonları incele (${count})`,
  staticFallback: "Statik yedek",
  title: (sceneIndex) => `Görsel beat ${sceneIndex} revizyonları`,
  useRevision: "Bu revizyonu kullan",
};

const englishCopy: VisualRevisionGalleryCopy = {
  canonical: "Canonical",
  compareHint: "Use left and right arrow keys to compare revisions.",
  compareDescription:
    "Compare verified candidates. The canonical revision is the one bound into the current render decision.",
  dimensionsUnavailable: "Dimensions unavailable",
  manualImport: "Manual import",
  mfluxLocal: "MFLUX Local",
  nextRevision: "Show next revision",
  previousRevision: "Show previous revision",
  recordedRevision: "Recorded revision",
  revision: (revision) => `Revision ${revision}`,
  reviewRevisions: (count) => `Review revisions (${count})`,
  staticFallback: "Static fallback",
  title: (sceneIndex) => `Visual beat ${sceneIndex} revisions`,
  useRevision: "Use this revision",
};
