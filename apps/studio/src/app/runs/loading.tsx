import { StudioLoadingScaffold } from "@/components/studio/StudioLoadingScaffold";

export default function RunsLoading() {
  return (
    <StudioLoadingScaffold
      eyebrow='Read-only local run review'
      railPanels={1}
      title='Producer runs'
    />
  );
}
