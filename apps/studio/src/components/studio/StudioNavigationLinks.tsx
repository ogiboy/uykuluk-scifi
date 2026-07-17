"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { StudioSection } from "@/lib/studioData";
import { cn } from "@/lib/utils";

/** Renders Studio links with a visible and accessible current-section state. */
export function StudioNavigationLinks({
  ariaLabel,
  sections,
}: Readonly<{ ariaLabel?: string; sections: readonly StudioSection[] }>) {
  const pathname = usePathname();
  return (
    <nav aria-label={ariaLabel} className='grid gap-1 max-[900px]:grid-cols-2'>
      {sections.map((section) => {
        const active = sectionIsActive(section.id, section.href, pathname);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-muted-foreground hover:bg-card hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors max-[900px]:min-w-0 max-[900px]:wrap-break-word",
              active && "bg-card text-foreground shadow-sm shadow-black/5",
            )}
            key={section.id}
            href={section.href}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

function sectionIsActive(id: string, href: string, pathname: string): boolean {
  if (id === "dashboard") return pathname === "/";
  if (id === "episodes") {
    return pathname.startsWith("/runs") || pathname.startsWith("/ideas");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
