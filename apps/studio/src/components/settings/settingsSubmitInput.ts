import type { StudioLocale } from "@/i18n/locales";
import type { ProducerConfig } from "../../../../../src/config/schema";
import type { PromptProfile } from "../../../../../src/prompts/profiles/promptProfileStore";

export function settingsSubmitInput({
  currentDigest,
  draft,
  editor,
  locale,
  note,
}: Readonly<{
  currentDigest: string;
  draft: ProducerConfig;
  editor: string;
  locale: StudioLocale;
  note: string;
}>) {
  return {
    actionId: "settings.save",
    body: {
      editor,
      expectedCurrentDigest: currentDigest,
      note,
      settings: {
        studio: draft.studio,
        providers: {
          llm: draft.providers.llm,
          tts: draft.providers.tts,
          imageGeneration: draft.providers.imageGeneration,
        },
        budgets: draft.budgets,
      },
    },
    errorToastTitle: locale === "tr" ? "Ayarlar kaydedilemedi" : "Settings could not be saved",
    fallbackError:
      locale === "tr"
        ? "Ayar revizyonu oluşturulamadı."
        : "The settings revision could not be created.",
    routePath: "/actions/settings-save",
    submittingMessage: locale === "tr" ? "Ayarlar kaydediliyor..." : "Saving settings...",
    successMessage:
      locale === "tr"
        ? "Ayar revizyonu kaydedildi. Sonraki işlem bu sürümü kullanır."
        : "Settings revision saved. The next operation will use this version.",
    successToastTitle: locale === "tr" ? "Ayarlar kaydedildi" : "Settings saved",
  };
}

export function profileSubmitInput({
  activeProfile,
  currentDigest,
  draft,
  editor,
  locale,
  profileDigests,
  profileNote,
  profilePrompt,
}: Readonly<{
  activeProfile: PromptProfile;
  currentDigest: string;
  draft: ProducerConfig;
  editor: string;
  locale: StudioLocale;
  profileDigests: Readonly<Record<string, string>>;
  profileNote: string;
  profilePrompt: string;
}>) {
  return {
    actionId: "promptProfiles.save",
    body: {
      editor,
      expectedCurrentDigest: currentDigest,
      expectedProfileDigest: profileDigests[activeProfile.id],
      makeActive: activeProfile.id === draft.editorial.activeProfileId,
      note: profileNote,
      profile: { ...activeProfile, generationPrompt: profilePrompt },
    },
    errorToastTitle: locale === "tr" ? "Profil kaydedilemedi" : "Profile could not be saved",
    fallbackError:
      locale === "tr"
        ? "Prompt profil revizyonu oluşturulamadı."
        : "The prompt profile revision could not be created.",
    routePath: "/actions/prompt-profiles-save",
    submittingMessage:
      locale === "tr" ? "Prompt profili kaydediliyor..." : "Saving prompt profile...",
    successMessage:
      locale === "tr"
        ? "Prompt profili kaydedildi. Yeni fikir işlemleri bu yönlendirmeyi kullanır."
        : "Prompt profile saved. New idea operations will use this direction.",
    successToastTitle: locale === "tr" ? "Prompt profili kaydedildi" : "Prompt profile saved",
  };
}

export function smokeSubmitInput({
  locale,
  text,
  voiceId,
}: Readonly<{ locale: StudioLocale; text: string; voiceId: string }>) {
  return {
    actionId: "providers.elevenlabs.smoke",
    body: { text, voiceId },
    errorToastTitle:
      locale === "tr" ? "ElevenLabs tanısı tamamlanamadı" : "ElevenLabs diagnostic blocked",
    fallbackError:
      locale === "tr"
        ? "Canlı kota veya sağlayıcı cevabı doğrulanamadı."
        : "Live quota or provider response could not be verified.",
    routePath: "/actions/elevenlabs-smoke",
    submittingMessage:
      locale === "tr"
        ? "Kota denetleniyor ve kısa tanı hazırlanıyor..."
        : "Checking quota and preparing a short diagnostic...",
    successMessage:
      locale === "tr"
        ? "Tanı kaydı tamamlandı. Ses yalnız bağlantı testi içindir."
        : "Diagnostic completed. The audio is only for connectivity testing.",
    successToastTitle:
      locale === "tr" ? "ElevenLabs tanısı tamamlandı" : "ElevenLabs diagnostic completed",
  };
}
