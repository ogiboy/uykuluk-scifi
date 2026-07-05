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
      className='mt-6 grid gap-3 rounded-xl border bg-card/70 p-3'
      aria-labelledby='appearance-controls-heading'
    >
      <div>
        <p className='text-xs text-muted-foreground'>Operator view</p>
        <h2 className='text-sm font-semibold' id='appearance-controls-heading'>
          Appearance
        </h2>
      </div>

      <div className='grid gap-2'>
        <div className='grid min-w-0 gap-2'>
          <Label className='text-xs text-muted-foreground' htmlFor='studio-theme-select'>
            Theme
          </Label>
          <Select value={preference.theme} onValueChange={updateTheme}>
            <SelectTrigger id='studio-theme-select' size='sm' className='w-full'>
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

        <div className='grid min-w-0 gap-2'>
          <Label className='text-xs text-muted-foreground' htmlFor='studio-palette-select'>
            Palette
          </Label>
          <Select value={preference.palette} onValueChange={updatePalette}>
            <SelectTrigger id='studio-palette-select' size='sm' className='w-full'>
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

        <div className='grid min-w-0 gap-2'>
          <Label className='text-xs text-muted-foreground' htmlFor='studio-locale-select'>
            Language
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
          <Label className='text-xs text-muted-foreground' id='studio-density-label'>
            Density
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
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </section>
  );
}
