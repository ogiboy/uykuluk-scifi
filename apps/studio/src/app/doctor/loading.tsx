import { StudioLoadingScaffold } from "@/components/studio/StudioLoadingScaffold";

export default function DoctorLoading() {
  return (
    <StudioLoadingScaffold
      eyebrow='Read-only project diagnostics'
      layout='shell'
      railPanels={2}
      title='Loading producer doctor diagnostics'
    />
  );
}
