import type { StudioLocale } from "@/i18n/locales";

type EpisodeBriefCopy = Readonly<{
  createIdeas: string;
  creatingIdeas: string;
  description: string;
  directionLabel: string;
  directionTitle: string;
  errorToastTitle: string;
  fallbackError: string;
  idleMessage: string;
  optionalBriefHelp: string;
  optionalBriefLabel: string;
  optionalBriefPlaceholder: string;
  snapshotNotice: string;
  submittingMessage: string;
  successMessage: string;
  successToastTitle: string;
  title: string;
}>;

const TURKISH_COPY: EpisodeBriefCopy = {
  createIdeas: "Fikir oluştur",
  creatingIdeas: "Başlatılıyor...",
  description: "Önce türü ve bölüm yönlendirmesini seçin. Teknik ayrıntılar arka planda saklanır.",
  directionLabel: "Tür / yönlendirme profili",
  directionTitle: "Başlangıç yönlendirmesi",
  errorToastTitle: "Bölüm oluşturulamadı",
  fallbackError: "Fikir üretimi başlatılamadı.",
  idleMessage: "Yeni bölüm fikri, seçtiğiniz profile göre oluşturulur.",
  optionalBriefHelp: "Boş bırakırsanız yalnız profil yönlendirmesi kullanılır.",
  optionalBriefLabel: "Bölüm fikri (isteğe bağlı)",
  optionalBriefPlaceholder: "Konu, hedef kitle veya özel yönlendirme ekleyin.",
  snapshotNotice: "Ayarlar ve profil, bu işlem için sabit bir anlık görüntü olarak kaydedilir.",
  submittingMessage: "Bölüm hazırlanıyor...",
  successMessage: "Bölüm oluşturuldu. Fikir adayları hazırlanıyor.",
  successToastTitle: "Bölüm oluşturuldu",
  title: "Yeni bölüm",
};

const ENGLISH_COPY: EpisodeBriefCopy = {
  createIdeas: "Create ideas",
  creatingIdeas: "Starting...",
  description:
    "Choose the genre and episode direction first. Technical details stay in the background.",
  directionLabel: "Genre / prompt profile",
  directionTitle: "Starting direction",
  errorToastTitle: "Episode could not be created",
  fallbackError: "Idea generation could not start.",
  idleMessage: "The new episode idea will use the selected profile.",
  optionalBriefHelp: "If left blank, only the profile direction is used.",
  optionalBriefLabel: "Episode idea (optional)",
  optionalBriefPlaceholder: "Add a topic, audience, or special direction.",
  snapshotNotice: "Settings and profile are recorded as a fixed snapshot for this operation.",
  submittingMessage: "Preparing episode...",
  successMessage: "Episode created. Idea candidates are being prepared.",
  successToastTitle: "Episode created",
  title: "New episode",
};

export function episodeBriefCopy(locale: StudioLocale, requiresBrief: boolean): EpisodeBriefCopy {
  const copy = locale === "tr" ? TURKISH_COPY : ENGLISH_COPY;
  if (!requiresBrief) return copy;

  return {
    ...copy,
    optionalBriefHelp:
      locale === "tr"
        ? "Bu profil için fikir metni zorunludur."
        : "An idea brief is required for this profile.",
    optionalBriefPlaceholder:
      locale === "tr"
        ? "Bu profil için kendi fikrinizi yazın."
        : "Write your own idea for this profile.",
  };
}
