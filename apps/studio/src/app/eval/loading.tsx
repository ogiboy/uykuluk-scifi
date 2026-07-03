import { StudioLoadingScaffold } from "@/components/studio/StudioLoadingScaffold";

export default function ModelEvalLoading() {
  return (
    <StudioLoadingScaffold
      eyebrow='Read-only local model evidence'
      layout='shell'
      railPanels={2}
      title='Loading local model evaluation'
    />
  );
}
