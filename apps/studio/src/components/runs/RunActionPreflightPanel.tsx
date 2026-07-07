import { Badge } from "@/components/ui/badge";
import type { StudioActionPreflight, StudioActionPreflightItem } from "@/lib/studioActionPreflight";

type RunActionPreflightPanelProps = Readonly<{ preflight: StudioActionPreflight }>;

/**
 * Renders a presentation-only preflight summary for guarded Studio actions.
 *
 * @param preflight - Derived operator copy for the current action and run state.
 */
export function RunActionPreflightPanel({ preflight }: RunActionPreflightPanelProps) {
  return (
    <section className='bg-muted/10 space-y-4 rounded-lg p-4' aria-label={preflight.title}>
      <div className='grid grid-cols-[1fr_auto] items-start gap-4'>
        <div>
          <h3 className='font-semibold'>{preflight.title}</h3>
          <p className='text-muted-foreground mt-1 text-sm'>{preflight.copy}</p>
        </div>
        <Badge variant='outline'>local only</Badge>
      </div>
      <dl className='grid gap-3'>
        {preflight.items.map((item) => (
          <div className='bg-background/45 rounded-md p-3' key={item.label}>
            <dt className='flex flex-wrap items-center gap-2 text-sm font-medium'>
              <Badge variant={preflightBadgeVariant(item.status)}>{item.status}</Badge>
              <span>{item.label}</span>
            </dt>
            <dd className='text-muted-foreground mt-2 text-sm'>{item.detail}</dd>
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
