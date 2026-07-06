import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioRouteBoundaryCopy } from "@/lib/studioRouteBoundaryCopy";

export type StudioRouteBoundaryAction = Readonly<{
  href: "/" | "/runs";
  label: string;
}>;

type StudioRouteBoundaryCardProps = Readonly<{
  actions?: readonly StudioRouteBoundaryAction[];
  children?: ReactNode;
  description: string;
  headingId: string;
  title: string;
}>;

/**
 * Default safe navigation options shown on Studio route boundaries.
 */
export const defaultStudioRouteBoundaryActions: readonly StudioRouteBoundaryAction[] = [
  { href: "/runs", label: "Open run queue" },
  { href: "/", label: "Open Studio home" },
];

/**
 * Renders safe route-boundary recovery guidance without exposing local filesystem details.
 *
 * @param actions - Safe navigation options that do not mutate producer state. Defaults to the
 *   run queue and Studio home links.
 * @param children - Optional extra recovery controls, such as a local retry button.
 * @param description - Operator-facing explanation for the boundary state.
 * @param headingId - Stable heading id for the recovery section.
 * @param title - Recovery section heading.
 */
export function StudioRouteBoundaryCard({
  actions = defaultStudioRouteBoundaryActions,
  children,
  description,
  headingId,
  title,
}: StudioRouteBoundaryCardProps) {
  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader>
          <CardTitle id={headingId}>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap items-center gap-2'>
          {children}
          {actions.map((action) => (
            <Link
              className={buttonVariants({ variant: "secondary" })}
              href={action.href}
              key={action.href}
            >
              {action.label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

type StudioRouteBoundaryHeaderProps = Readonly<{
  copy: StudioRouteBoundaryCopy;
  headingId?: string;
}>;

/**
 * Renders the route-boundary heading and fail-closed status badge.
 *
 * @param copy - Operator-facing boundary copy.
 * @param headingId - Optional id used when the route owns an aria-labelledby target.
 */
export function StudioRouteBoundaryHeader({ copy, headingId }: StudioRouteBoundaryHeaderProps) {
  return (
    <header className='grid gap-4 border-b border-border/40 pb-6 sm:grid-cols-[1fr_auto] sm:items-start'>
      <div className='space-y-2'>
        <p className='text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground'>
          {copy.eyebrow}
        </p>
        <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl' id={headingId}>
          {copy.heading}
        </h1>
      </div>
      <Badge className='justify-self-start sm:justify-self-end' variant='destructive'>
        {copy.status}
      </Badge>
    </header>
  );
}
