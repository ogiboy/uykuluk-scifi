import { StudioLoadingScaffold } from "@/components/studio/StudioLoadingScaffold";

export default function AnalyticsLoading() {
  return (
    <StudioLoadingScaffold
      eyebrow='Read-only manual feedback loop'
      layout='shell'
      railPanels={2}
      title='Loading analytics feedback'
    />
  );
}
