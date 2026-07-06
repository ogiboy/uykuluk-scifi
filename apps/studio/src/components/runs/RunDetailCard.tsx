import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RunDetailCardProps = Readonly<{
  headingId: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}>;

type RunDetailStatusTone = "blocked" | "neutral" | "success" | "warning";

type RunDetailStatusBadgeProps = Readonly<{
  children: ReactNode;
  tone: RunDetailStatusTone;
}>;

export type RunMetadataItem = Readonly<{
  label: string;
  value: ReactNode;
}>;

/**
 * Renders a consistent shadcn/Tailwind card shell for read-only run detail panels.
 *
 * @param headingId - The ID used to label the panel region.
 * @param title - The visible panel title.
 * @param description - Optional copy rendered below the title.
 * @param children - The panel body content.
 */
export function RunDetailCard({ headingId, title, description, children }: RunDetailCardProps) {
  return (
    <section aria-labelledby={headingId}>
      <Card className='h-full'>
        <CardHeader>
          <CardTitle>
            <h2 id={headingId} className='text-base font-semibold tracking-tight'>
              {title}
            </h2>
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className='grid gap-4 text-sm'>{children}</CardContent>
      </Card>
    </section>
  );
}

/**
 * Renders a compact status badge for run detail cards without relying on legacy global classes.
 *
 * @param children - The status label.
 * @param tone - The operator-facing tone for the status.
 */
export function RunDetailStatusBadge({ children, tone }: RunDetailStatusBadgeProps) {
  return (
    <Badge
      className={cn(
        "capitalize",
        tone === "warning" &&
          "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
      )}
      variant={runDetailStatusVariant(tone)}
    >
      {children}
    </Badge>
  );
}

/**
 * Renders a responsive metadata definition list for run detail cards.
 *
 * @param items - Metadata entries to display.
 */
export function RunMetadataList({ items }: Readonly<{ items: readonly RunMetadataItem[] }>) {
  return (
    <dl className='grid gap-3 sm:grid-cols-2'>
      {items.map((item) => (
        <div className='min-w-0 rounded-lg bg-muted/15 p-3 ring-1 ring-border/5' key={item.label}>
          <dt className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            {item.label}
          </dt>
          <dd className='mt-1 min-w-0 break-words text-sm text-foreground'>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function runDetailStatusVariant(tone: RunDetailStatusTone) {
  if (tone === "blocked") {
    return "destructive";
  }
  if (tone === "success") {
    return "secondary";
  }
  return "outline";
}
