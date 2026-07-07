import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

type StudioPageHeaderProps = Readonly<{
  actions?: ReactNode;
  badge?: string;
  eyebrow: string;
  title: string;
}>;

/**
 * Renders the standard Studio route header without relying on global header classes.
 *
 * @param actions - Optional right-side controls, links, or status badges.
 * @param badge - Optional read-only status badge when no custom actions are needed.
 * @param eyebrow - Short uppercase route context.
 * @param title - Primary route heading.
 */
export function StudioPageHeader({ actions, badge, eyebrow, title }: StudioPageHeaderProps) {
  const headerActions = actions ?? (badge ? <Badge variant='secondary'>{badge}</Badge> : null);

  return (
    <header className='grid gap-4 pb-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
      <div className='min-w-0 space-y-2'>
        <p className='text-muted-foreground text-xs font-semibold tracking-[0.28em] uppercase'>
          {eyebrow}
        </p>
        <h1 className='max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl'>{title}</h1>
      </div>
      {headerActions ? (
        <div className='flex flex-wrap items-center gap-2 sm:justify-end'>{headerActions}</div>
      ) : null}
    </header>
  );
}
