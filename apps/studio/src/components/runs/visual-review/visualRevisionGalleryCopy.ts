import type { StudioLocale } from "@/i18n/locales";

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

export function visualRevisionGalleryCopy(locale: StudioLocale): VisualRevisionGalleryCopy {
  return locale === "tr" ? turkishCopy : englishCopy;
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
