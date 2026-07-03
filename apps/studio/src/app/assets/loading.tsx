import { StudioLoadingScaffold } from "@/components/studio/StudioLoadingScaffold";

export default function AssetsLoading() {
  return (
    <StudioLoadingScaffold
      eyebrow='Read-only production inputs'
      layout='shell'
      railPanels={2}
      title='Loading visual asset inventory'
    />
  );
}
