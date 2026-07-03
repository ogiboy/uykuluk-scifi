import { StudioLoadingScaffold } from "@/components/studio/StudioLoadingScaffold";

export default function RunsLoading() {
  return (
    <StudioLoadingScaffold
      eyebrow='Read-only local run review'
      layout='shell'
      railPanels={1}
      title='Producer runs'
    />
  );
}
