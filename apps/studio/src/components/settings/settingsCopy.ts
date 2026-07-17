import type { StudioLocale } from "@/i18n/locales";

export type StudioSettingsCopy = Readonly<{
  advanced: string;
  advancedDescription: string;
  applyNextOperation: string;
  brief: string;
  briefDescription: string;
  budgets: string;
  configured: string;
  currentRevision: string;
  editor: string;
  english: string;
  generationPrompt: string;
  locale: string;
  model: string;
  missing: string;
  note: string;
  profile: string;
  provider: string;
  restartRequired: string;
  saveProfile: string;
  saveSettings: string;
  secretStatus: string;
  settings: string;
  theme: string;
  turkish: string;
}>;

const TURKISH_COPY: StudioSettingsCopy = {
  advanced: "Gelişmiş",
  advancedDescription:
    "Sağlayıcı, model, bütçe ve çalışma zamanı tercihleri. Gizli anahtarlar burada hiç gösterilmez.",
  applyNextOperation:
    "Kaydedilen ayarlar sonraki işlemde kullanılır. Devam eden işlemler kendi sabit anlık görüntüsüyle tamamlanır.",
  brief: "Bölüm yönlendirmesi",
  briefDescription: "Bu profil, yeni fikir üretiminde saklanan başlangıç yönlendirmesidir.",
  budgets: "Bütçeler",
  configured: "Yapılandırıldı",
  currentRevision: "Geçerli ayar revizyonu",
  editor: "Düzenleyen",
  english: "English",
  generationPrompt: "Fikir üretim yönlendirmesi",
  locale: "Dil",
  model: "Model",
  missing: "Eksik",
  note: "Revizyon notu",
  profile: "Tür / yönlendirme profili",
  provider: "Sağlayıcı",
  restartRequired: "Port değişikliği kontrollü yeniden başlatma gerektirir.",
  saveProfile: "Prompt profilini kaydet",
  saveSettings: "Ayar revizyonunu kaydet",
  secretStatus: "Gizli anahtar durumu",
  settings: "Ayarlar",
  theme: "Tema",
  turkish: "Türkçe",
};

const ENGLISH_COPY: StudioSettingsCopy = {
  advanced: "Advanced",
  advancedDescription:
    "Provider, model, budget, and runtime preferences. Secret keys are never displayed here.",
  applyNextOperation:
    "Saved settings apply to the next operation. In-progress work completes with its pinned snapshot.",
  brief: "Episode direction",
  briefDescription: "This profile is the stored starting direction for new idea generation.",
  budgets: "Budgets",
  configured: "Configured",
  currentRevision: "Current settings revision",
  editor: "Edited by",
  english: "English",
  generationPrompt: "Idea generation direction",
  locale: "Language",
  model: "Model",
  missing: "Missing",
  note: "Revision note",
  profile: "Genre / prompt profile",
  provider: "Provider",
  restartRequired: "Changing the port requires a controlled restart.",
  saveProfile: "Save prompt profile",
  saveSettings: "Save settings revision",
  secretStatus: "Secret key status",
  settings: "Settings",
  theme: "Theme",
  turkish: "Turkish",
};

/** Returns the complete settings surface copy for the selected Studio language. */
export function settingsCopy(locale: StudioLocale): StudioSettingsCopy {
  return locale === "tr" ? TURKISH_COPY : ENGLISH_COPY;
}
