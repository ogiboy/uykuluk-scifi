import type { StudioLocale } from "./locales";

export type StudioMessages = { common: { appName: string } };

export const EN_MESSAGES = {
  common: { appName: "UykulukSciFi Producer Studio" },
} satisfies StudioMessages;

export const TR_MESSAGES = {
  common: { appName: "UykulukSciFi Producer Studio" },
} satisfies StudioMessages;

export const STUDIO_MESSAGES: Record<StudioLocale, StudioMessages> = {
  en: EN_MESSAGES,
  tr: TR_MESSAGES,
};
