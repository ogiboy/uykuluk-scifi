import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { normalizeStudioLocale } from "@/i18n/locales";

import { StudioNavigationRail } from "./StudioNavigationRail";
import { studioMainClassName, studioShellClassName } from "./studioShellClasses";

/**
 * Renders the persistent Studio application shell around operator pages.
 *
 * @param children - Route content owned by the active Studio page.
 */
export async function StudioShell({ children }: Readonly<{ children: ReactNode }>) {
  const locale = normalizeStudioLocale(await getLocale());

  return (
    <main className={studioShellClassName}>
      <StudioNavigationRail locale={locale} />
      <section className={studioMainClassName}>{children}</section>
    </main>
  );
}
