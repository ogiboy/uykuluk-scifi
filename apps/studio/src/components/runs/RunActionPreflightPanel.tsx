import { Badge } from "@/components/ui/badge";
import type { StudioActionPreflight, StudioActionPreflightItem } from "@/lib/studioActionPreflight";

type RunActionPreflightPanelProps = Readonly<{
  preflight: StudioActionPreflight;
}>;

/**
 * Renders a presentation-only preflight summary for guarded Studio actions.
 *
 * @param preflight - Derived operator copy for the current action and run state.
 */
export function RunActionPreflightPanel({ preflight }: RunActionPreflightPanelProps) {
  return (
    <section className='space-y-4 rounded-lg border bg-muted/30 p-4' aria-label={preflight.title}>
      <div className='grid grid-cols-[1fr_auto] items-start gap-4'>
        <div>
          <h3 className='font-semibold'>{preflight.title}</h3>
          <p className='mt-1 text-sm text-muted-foreground'>{preflight.copy}</p>
        </div>
        <Badge variant='outline'>local only</Badge>
      </div>
      <dl className='grid gap-3'>
        {preflight.items.map((item) => (
          <div className='rounded-md border bg-background p-3' key={item.label}>
            <dt className='flex flex-wrap items-center gap-2 text-sm font-medium'>
              <Badge variant={preflightBadgeVariant(item.status)}>{item.status}</Badge>
              <span>{item.label}</span>
            </dt>
            <dd className='mt-2 text-sm text-muted-foreground'>{item.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function preflightBadgeVariant(
  status: StudioActionPreflightItem["status"],
): "destructive" | "outline" | "secondary" {
  if (status === "attention") {
    return "destructive";
  }
  if (status === "pending") {
    return "outline";
  }
  return "secondary";
}
