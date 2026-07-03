"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { StudioLocale } from "@/i18n/locales";
import { STUDIO_DEFAULT_LOCALE, STUDIO_LOCALE_COOKIE, STUDIO_LOCALES } from "@/i18n/locales";

type StudioTheme = "dark" | "light" | "system";
type StudioPalette = "cyan" | "amber" | "violet";
type StudioDensity = "compact" | "standard" | "wide";

type StudioAppearancePreference = Readonly<{
  density: StudioDensity;
  locale: StudioLocale;
  palette: StudioPalette;
  theme: StudioTheme;
}>;

const appearanceStorageKey = "uykuluk-studio-appearance";
const appearanceStorageEvent = "uykuluk-studio-appearance-change";
const cookieMaxAgeSeconds = 60 * 60 * 24 * 365;

const themeOptions = [
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
  { label: "System", value: "system" },
] as const satisfies ReadonlyArray<{ label: string; value: StudioTheme }>;

const paletteOptions = [
  { label: "Cyan", value: "cyan" },
  { label: "Amber", value: "amber" },
  { label: "Violet", value: "violet" },
] as const satisfies ReadonlyArray<{ label: string; value: StudioPalette }>;

const densityOptions = [
  { label: "Compact", value: "compact" },
  { label: "Standard", value: "standard" },
  { label: "Wide", value: "wide" },
] as const satisfies ReadonlyArray<{ label: string; value: StudioDensity }>;

const localeOptions = [
  { label: "English", value: "en" },
  { label: "Türkçe", value: "tr" },
] as const satisfies ReadonlyArray<{ label: string; value: StudioLocale }>;

function defaultPreference(locale: StudioLocale): StudioAppearancePreference {
  return {
    density: "standard",
    locale,
    palette: "cyan",
    theme: "dark",
  };
}

/**
 * Lets the local operator tune Studio appearance without touching workflow state.
 *
 * @param initialLocale - Locale resolved from the Studio request cookie.
 */
export function StudioAppearanceControls({
  initialLocale,
}: Readonly<{ initialLocale: StudioLocale }>) {
  const router = useRouter();
  const rawPreference = useSyncExternalStore(
    subscribeAppearancePreference,
    readStoredPreferenceText,
    () => null,
  );
  const preference = useMemo(
    () => readStoredPreference(initialLocale, rawPreference),
    [initialLocale, rawPreference],
  );

  useEffect(() => {
    applyAppearancePreference(preference);
  }, [preference]);

  function updateTheme(theme: StudioTheme) {
    persistAppearancePreference({ ...preference, theme });
  }

  function updatePalette(palette: StudioPalette) {
    persistAppearancePreference({ ...preference, palette });
  }

  function updateDensity(density: StudioDensity) {
    persistAppearancePreference({ ...preference, density });
  }

  function updateLocale(locale: StudioLocale) {
    persistAppearancePreference({ ...preference, locale });
    document.cookie = `${STUDIO_LOCALE_COOKIE}=${locale}; path=/; max-age=${cookieMaxAgeSeconds}; SameSite=Lax`;
    document.documentElement.lang = locale;
    router.refresh();
  }

  return (
    <section className='appearance-controls' aria-labelledby='appearance-controls-heading'>
      <div>
        <p className='eyebrow'>Operator view</p>
        <h2 id='appearance-controls-heading'>Appearance</h2>
      </div>

      <div className='appearance-control-grid'>
        <div className='appearance-field'>
          <Label htmlFor='studio-theme-select'>Theme</Label>
          <Select value={preference.theme} onValueChange={updateTheme}>
            <SelectTrigger id='studio-theme-select' size='sm' className='appearance-select'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='appearance-field'>
          <Label htmlFor='studio-palette-select'>Palette</Label>
          <Select value={preference.palette} onValueChange={updatePalette}>
            <SelectTrigger id='studio-palette-select' size='sm' className='appearance-select'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paletteOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='appearance-field'>
          <Label htmlFor='studio-locale-select'>Language</Label>
          <Select value={preference.locale} onValueChange={updateLocale}>
            <SelectTrigger id='studio-locale-select' size='sm' className='appearance-select'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {localeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='appearance-field appearance-density-field'>
          <Label id='studio-density-label'>Density</Label>
          <ToggleGroup
            aria-labelledby='studio-density-label'
            className='appearance-density-toggle'
            onValueChange={(value: StudioDensity) => {
              if (isStudioDensity(value)) {
                updateDensity(value);
              }
            }}
            size='sm'
            type='single'
            value={preference.density}
            variant='outline'
          >
            {densityOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </section>
  );
}

function applyAppearancePreference(preference: StudioAppearancePreference) {
  const root = document.documentElement;
  root.dataset.studioDensity = preference.density;
  root.dataset.studioPalette = preference.palette;
  root.dataset.studioTheme = preference.theme;
}

function persistAppearancePreference(preference: StudioAppearancePreference) {
  try {
    window.localStorage.setItem(appearanceStorageKey, JSON.stringify(preference));
    window.dispatchEvent(new Event(appearanceStorageEvent));
  } catch (error) {
    console.warn("Studio appearance preferences could not be saved.", error);
  }
}

function readStoredPreference(
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

function readStoredPreferenceText(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(appearanceStorageKey);
  } catch (error) {
    console.warn("Studio appearance preferences could not be loaded.", error);
    return null;
  }
}

function subscribeAppearancePreference(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(appearanceStorageEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(appearanceStorageEvent, onStoreChange);
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

function isStudioDensity(value: unknown): value is StudioDensity {
  return value === "compact" || value === "standard" || value === "wide";
}

function isStudioLocale(value: unknown): value is StudioLocale {
  return STUDIO_LOCALES.includes(value as StudioLocale) || value === STUDIO_DEFAULT_LOCALE;
}
