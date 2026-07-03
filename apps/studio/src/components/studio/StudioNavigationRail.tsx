import Link from "next/link";

import type { StudioLocale } from "@/i18n/locales";
import { studioSections } from "@/lib/studioData";

import { StudioAppearanceControls } from "./StudioAppearanceControls";
import { StudioBrandLockup } from "./StudioBrandLockup";

/**
 * Renders the persistent Studio navigation rail.
 *
 * Route links use Next navigation. Home-only sections point back to the Studio home anchors so the
 * rail remains valid from every operator page.
 */
export function StudioNavigationRail({ locale }: Readonly<{ locale: StudioLocale }>) {
  return (
    <aside className='studio-rail' aria-label='Studio navigation'>
      <StudioBrandLockup />
      <nav>
        {studioSections.map((section) =>
          "href" in section ? (
            <Link key={section.id} href={section.href}>
              {section.label}
            </Link>
          ) : (
            <Link key={section.id} href={`/#${section.id}`}>
              {section.label}
            </Link>
          ),
        )}
      </nav>
      <StudioAppearanceControls initialLocale={locale} />
    </aside>
  );
}
