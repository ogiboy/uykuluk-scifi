import { Badge } from "@/components/ui/badge";
import type { StudioActionPreflight } from "@/lib/studioActionPreflight";

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
    <section className='action-preflight' aria-label={preflight.title}>
      <div className='action-preflight-heading'>
        <div>
          <h3>{preflight.title}</h3>
          <p>{preflight.copy}</p>
        </div>
        <Badge variant='outline'>local only</Badge>
      </div>
      <dl className='action-preflight-list'>
        {preflight.items.map((item) => (
          <div key={item.label}>
            <dt>
              <span className={`status-pill small ${item.status}`}>{item.status}</span>
              {item.label}
            </dt>
            <dd>{item.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
