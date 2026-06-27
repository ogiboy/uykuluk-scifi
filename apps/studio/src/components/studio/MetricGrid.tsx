export type StudioMetric = {
  label: string;
  value: string;
};

type MetricGridProps = Readonly<{
  metrics: readonly StudioMetric[];
}>;

/**
 * Renders a Studio metadata grid with label/value pairs.
 *
 * @param metrics - Metrics to display.
 * @returns A definition-list metric grid.
 */
export function MetricGrid({ metrics }: MetricGridProps) {
  return (
    <dl className='run-metadata'>
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
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
