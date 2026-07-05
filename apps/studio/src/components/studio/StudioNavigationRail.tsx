import Link from "next/link";
import type { Route } from "next";

import type { StudioLocale } from "@/i18n/locales";
import { studioSections } from "@/lib/studioData";

import { StudioAppearanceControls } from "./StudioAppearanceControls";
import { StudioBrandLockup } from "./StudioBrandLockup";
import { studioRailClassName } from "./studioShellClasses";

/**
 * Renders the persistent Studio navigation rail.
 *
 * Route links use Next navigation. Home-only sections point back to the Studio home anchors so the
 * rail remains valid from every operator page.
 */
export function StudioNavigationRail({ locale }: Readonly<{ locale: StudioLocale }>) {
  return (
    <aside className={studioRailClassName} aria-label='Studio navigation'>
      <StudioBrandLockup />
      <nav className='grid gap-1 max-[900px]:grid-cols-2'>
        {studioSections.map((section) =>
          "href" in section ? (
            <Link
              className='rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground max-[900px]:min-w-0 max-[900px]:break-words'
              key={section.id}
              href={section.href as Route}
            >
              {section.label}
            </Link>
          ) : (
            <Link
              className='rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground max-[900px]:min-w-0 max-[900px]:break-words'
              key={section.id}
              href={`/#${section.id}`}
            >
              {section.label}
            </Link>
          ),
        )}
      </nav>
      <StudioAppearanceControls initialLocale={locale} />
    </aside>
  );
}
