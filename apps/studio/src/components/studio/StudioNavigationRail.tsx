import type { StudioLocale } from "@/i18n/locales";
import {
  advancedStudioSectionsForLocale,
  studioSectionsForLocale,
  type StudioSection,
} from "@/lib/studioData";

import { StudioAppearanceControls } from "./StudioAppearanceControls";
import { StudioBrandLockup } from "./StudioBrandLockup";
import { StudioNavigationLinks } from "./StudioNavigationLinks";
import { studioRailClassName } from "./studioShellClasses";

/**
 * Renders the persistent Studio navigation rail.
 *
 * Route links use Next navigation so the rail remains valid from every operator page.
 */
export function StudioNavigationRail({ locale }: Readonly<{ locale: StudioLocale }>) {
  const sections = studioSectionsForLocale(locale);
  const advancedSections = advancedStudioSectionsForLocale(locale);
  return (
    <aside
      className={studioRailClassName}
      aria-label={locale === "tr" ? "Studio gezinmesi" : "Studio navigation"}
    >
      <div className='max-[900px]:hidden'>
        <StudioBrandLockup />
        <StudioNavigationLinks sections={sections} />
        <AdvancedNavigation locale={locale} sections={advancedSections} />
        <StudioAppearanceControls initialLocale={locale} />
      </div>

      <div className='hidden max-[900px]:block'>
        <div className='[&>a]:mb-4'>
          <StudioBrandLockup />
        </div>
        <details className='bg-background/35 rounded-xl border border-(--line) px-3 py-1'>
          <summary className='cursor-pointer py-3 text-sm font-semibold'>
            {locale === "tr" ? "Menü ve görünüm" : "Menu and appearance"}
          </summary>
          <div className='grid gap-4 border-t border-(--line) pt-3 pb-3'>
            <StudioNavigationLinks sections={sections} />
            <AdvancedNavigation locale={locale} sections={advancedSections} />
            <StudioAppearanceControls initialLocale={locale} />
          </div>
        </details>
      </div>
    </aside>
  );
}

function AdvancedNavigation({
  locale,
  sections,
}: Readonly<{ locale: StudioLocale; sections: readonly StudioSection[] }>) {
  return (
    <details className='mt-3 max-[900px]:mt-0'>
      <summary className='text-muted-foreground hover:text-foreground cursor-pointer rounded-md px-3 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors'>
        {locale === "tr" ? "Gelişmiş" : "Advanced"}
      </summary>
      <StudioNavigationLinks
        ariaLabel={locale === "tr" ? "Gelişmiş Studio gezinmesi" : "Advanced Studio navigation"}
        sections={sections}
      />
    </details>
  );
}
