import { StudioLoadingScaffold } from "@/components/studio/StudioLoadingScaffold";

export default function PromptsLoading() {
  return (
    <StudioLoadingScaffold
      eyebrow='Read-only prompt sources'
      layout='shell'
      railPanels={2}
      title='Loading runtime prompt inventory'
    />
  );
}
