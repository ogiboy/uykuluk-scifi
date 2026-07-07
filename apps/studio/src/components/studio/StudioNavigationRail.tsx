import type { Route } from "next";
import Link from "next/link";

import type { StudioLocale } from "@/i18n/locales";
import { studioSections } from "@/lib/studioData";

import { StudioAppearanceControls } from "./StudioAppearanceControls";
import { StudioBrandLockup } from "./StudioBrandLockup";
import { studioRailClassName } from "./studioShellClasses";

/**
 * Renders the persistent Studio navigation rail.
 *
 * Route links use Next navigation so the rail remains valid from every operator page.
 */
export function StudioNavigationRail({ locale }: Readonly<{ locale: StudioLocale }>) {
  return (
    <aside className={studioRailClassName} aria-label='Studio navigation'>
      <StudioBrandLockup />
      <nav className='grid gap-1 max-[900px]:grid-cols-2'>
        {studioSections.map((section) => (
          <Link
            className='text-muted-foreground hover:bg-card hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors max-[900px]:min-w-0 max-[900px]:break-words'
            key={section.id}
            href={section.href as Route}
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <StudioAppearanceControls initialLocale={locale} />
    </aside>
  );
}
