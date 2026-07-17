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
import {
  applyAppearancePreference,
  densityOptions,
  isStudioDensity,
  localeOptions,
  paletteOptions,
  persistAppearancePreference,
  readStoredPreference,
  readStoredPreferenceText,
  studioLocaleCookie,
  subscribeAppearancePreference,
  themeOptions,
  type StudioDensity,
  type StudioPalette,
  type StudioTheme,
} from "./studioAppearancePreferences";

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
  const copy = appearanceCopy(preference.locale);

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
    document.cookie = studioLocaleCookie(locale);
    document.documentElement.lang = locale;
    router.refresh();
  }

  return (
    <section
      className='bg-card/40 mt-6 grid gap-3 rounded-xl p-3'
      aria-labelledby='appearance-controls-heading'
    >
      <div>
        <p className='text-muted-foreground text-xs'>{copy.eyebrow}</p>
        <h2 className='text-sm font-semibold' id='appearance-controls-heading'>
          {copy.heading}
        </h2>
      </div>

      <div className='grid gap-2'>
        <div className='grid min-w-0 gap-2'>
          <Label className='text-muted-foreground text-xs' htmlFor='studio-theme-select'>
            {copy.theme}
          </Label>
          <Select value={preference.theme} onValueChange={updateTheme}>
            <SelectTrigger id='studio-theme-select' size='sm' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {copy.themeOptions[option.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='grid min-w-0 gap-2'>
          <Label className='text-muted-foreground text-xs' htmlFor='studio-palette-select'>
            {copy.palette}
          </Label>
          <Select value={preference.palette} onValueChange={updatePalette}>
            <SelectTrigger id='studio-palette-select' size='sm' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paletteOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {copy.paletteOptions[option.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='grid min-w-0 gap-2'>
          <Label className='text-muted-foreground text-xs' htmlFor='studio-locale-select'>
            {copy.language}
          </Label>
          <Select value={preference.locale} onValueChange={updateLocale}>
            <SelectTrigger id='studio-locale-select' size='sm' className='w-full'>
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

        <div className='grid min-w-0 gap-2'>
          <Label className='text-muted-foreground text-xs' id='studio-density-label'>
            {copy.density}
          </Label>
          <ToggleGroup
            aria-labelledby='studio-density-label'
            className='grid w-full grid-cols-3'
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
              <ToggleGroupItem
                className='min-w-0 px-1 text-[11px]'
                key={option.value}
                value={option.value}
              >
                {copy.densityOptions[option.value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </section>
  );
}

function appearanceCopy(locale: StudioLocale) {
  if (locale === "tr") {
    return {
      density: "Yoğunluk",
      densityOptions: { compact: "Sıkı", standard: "Standart", wide: "Geniş" },
      eyebrow: "Operatör görünümü",
      heading: "Görünüm",
      language: "Dil",
      palette: "Palet",
      paletteOptions: { amber: "Kehribar", cyan: "Camgöbeği", violet: "Menekşe" },
      theme: "Tema",
      themeOptions: { dark: "Koyu", light: "Açık", system: "Sistem" },
    } as const;
  }
  return {
    density: "Density",
    densityOptions: { compact: "Compact", standard: "Standard", wide: "Wide" },
    eyebrow: "Operator view",
    heading: "Appearance",
    language: "Language",
    palette: "Palette",
    paletteOptions: { amber: "Amber", cyan: "Cyan", violet: "Violet" },
    theme: "Theme",
    themeOptions: { dark: "Dark", light: "Light", system: "System" },
  } as const;
}
