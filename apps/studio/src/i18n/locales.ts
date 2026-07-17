export const STUDIO_DEFAULT_LOCALE = "tr";
export const STUDIO_LOCALE_COOKIE = "uykuluk_studio_locale";

export const STUDIO_LOCALES = ["en", "tr"] as const;

export type StudioLocale = (typeof STUDIO_LOCALES)[number];

export function normalizeStudioLocale(value: unknown): StudioLocale {
  if (typeof value !== "string") {
    return STUDIO_DEFAULT_LOCALE;
  }
  const normalized = value.toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }
  if (normalized === "tr" || normalized.startsWith("tr-")) {
    return "tr";
  }
  return STUDIO_DEFAULT_LOCALE;
}
