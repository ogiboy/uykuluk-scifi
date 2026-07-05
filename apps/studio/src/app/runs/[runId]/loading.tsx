import { StudioLoadingScaffold } from "@/components/studio/StudioLoadingScaffold";

export default function RunDetailLoading() {
  return (
    <StudioLoadingScaffold
      eyebrow='Run review workspace'
      layout='shell'
      railPanels={3}
      title='Loading run review workspace'
    />
  );
}
