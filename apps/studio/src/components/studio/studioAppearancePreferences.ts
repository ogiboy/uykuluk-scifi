import type { StudioLocale } from "@/i18n/locales";
import { STUDIO_DEFAULT_LOCALE, STUDIO_LOCALE_COOKIE, STUDIO_LOCALES } from "@/i18n/locales";

export type StudioTheme = "dark" | "light" | "system";
export type StudioPalette = "cyan" | "amber" | "violet";
export type StudioDensity = "compact" | "standard" | "wide";

export type StudioAppearancePreference = Readonly<{
  density: StudioDensity;
  locale: StudioLocale;
  palette: StudioPalette;
  theme: StudioTheme;
}>;

export const cookieMaxAgeSeconds = 60 * 60 * 24 * 365;

export const themeOptions = [
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
  { label: "System", value: "system" },
] as const satisfies ReadonlyArray<{ label: string; value: StudioTheme }>;

export const paletteOptions = [
  { label: "Cyan", value: "cyan" },
  { label: "Amber", value: "amber" },
  { label: "Violet", value: "violet" },
] as const satisfies ReadonlyArray<{ label: string; value: StudioPalette }>;

export const densityOptions = [
  { label: "Compact", value: "compact" },
  { label: "Standard", value: "standard" },
  { label: "Wide", value: "wide" },
] as const satisfies ReadonlyArray<{ label: string; value: StudioDensity }>;

export const localeOptions = [
  { label: "English", value: "en" },
  { label: "Türkçe", value: "tr" },
] as const satisfies ReadonlyArray<{ label: string; value: StudioLocale }>;

const appearanceStorageKey = "uykuluk-studio-appearance";
const appearanceStorageEvent = "uykuluk-studio-appearance-change";

export function applyAppearancePreference(preference: StudioAppearancePreference) {
  const root = document.documentElement;
  root.dataset.studioDensity = preference.density;
  root.dataset.studioPalette = preference.palette;
  root.dataset.studioTheme = preference.theme;
}

export function persistAppearancePreference(preference: StudioAppearancePreference) {
  try {
    globalThis.localStorage.setItem(appearanceStorageKey, JSON.stringify(preference));
    globalThis.dispatchEvent(new Event(appearanceStorageEvent));
  } catch (error) {
    console.warn("Studio appearance preferences could not be saved.", error);
  }
}

export function readStoredPreference(
  initialLocale: StudioLocale,
  rawPreference: string | null,
): StudioAppearancePreference {
  const fallback = defaultPreference(initialLocale);
  if (!rawPreference) {
    return fallback;
  }

  const parsedPreference = parseStoredPreference(rawPreference);
  if (!isStoredPreference(parsedPreference)) {
    return fallback;
  }

  return {
    density: parsedPreference.density,
    locale: parsedPreference.locale,
    palette: parsedPreference.palette,
    theme: parsedPreference.theme,
  };
}

export function readStoredPreferenceText(): string | null {
  if (typeof globalThis.window === "undefined") {
    return null;
  }
  try {
    return globalThis.localStorage.getItem(appearanceStorageKey);
  } catch (error) {
    console.warn("Studio appearance preferences could not be loaded.", error);
    return null;
  }
}

export function subscribeAppearancePreference(onStoreChange: () => void): () => void {
  globalThis.addEventListener("storage", onStoreChange);
  globalThis.addEventListener(appearanceStorageEvent, onStoreChange);
  return () => {
    globalThis.removeEventListener("storage", onStoreChange);
    globalThis.removeEventListener(appearanceStorageEvent, onStoreChange);
  };
}

export function isStudioDensity(value: unknown): value is StudioDensity {
  return value === "compact" || value === "standard" || value === "wide";
}

function defaultPreference(locale: StudioLocale): StudioAppearancePreference {
  return {
    density: "standard",
    locale,
    palette: "cyan",
    theme: "dark",
  };
}

function parseStoredPreference(rawPreference: string): unknown {
  try {
    return JSON.parse(rawPreference) as unknown;
  } catch (error) {
    console.warn(
      "Studio appearance preferences were ignored because they are invalid JSON.",
      error,
    );
    return null;
  }
}

function isStoredPreference(value: unknown): value is StudioAppearancePreference {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<Record<keyof StudioAppearancePreference, unknown>>;
  return (
    isStudioDensity(candidate.density) &&
    isStudioLocale(candidate.locale) &&
    isStudioPalette(candidate.palette) &&
    isStudioTheme(candidate.theme)
  );
}

function isStudioTheme(value: unknown): value is StudioTheme {
  return value === "dark" || value === "light" || value === "system";
}

function isStudioPalette(value: unknown): value is StudioPalette {
  return value === "cyan" || value === "amber" || value === "violet";
}

function isStudioLocale(value: unknown): value is StudioLocale {
  return STUDIO_LOCALES.includes(value as StudioLocale) || value === STUDIO_DEFAULT_LOCALE;
}

export function studioLocaleCookie(locale: StudioLocale): string {
  return `${STUDIO_LOCALE_COOKIE}=${locale}; path=/; max-age=${cookieMaxAgeSeconds}; SameSite=Lax`;
}
