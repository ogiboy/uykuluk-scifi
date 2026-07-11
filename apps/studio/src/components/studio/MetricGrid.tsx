export type StudioMetric = { label: string; value: string };

type MetricGridProps = Readonly<{ metrics: readonly StudioMetric[] }>;

/**
 * Renders a Studio metadata grid with label/value pairs.
 *
 * @param metrics - Metrics to display.
 * @returns A definition-list metric grid.
 */
export function MetricGrid({ metrics }: MetricGridProps) {
  return (
    <dl className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
      {metrics.map((metric) => (
        <div className='bg-background/20 min-w-0 rounded-lg p-3' key={metric.label}>
          <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            {metric.label}
          </dt>
          <dd className='mt-1 text-sm font-semibold break-words' title={metric.value}>
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Formats a number as a rounded US locale integer.
 *
 * @param value - The number to format.
 * @returns The rounded number formatted with US digit separators.
 */
export function formatStudioInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
