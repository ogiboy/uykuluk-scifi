import { StudioLoadingScaffold } from "@/components/studio/StudioLoadingScaffold";

export default function StudioHomeLoading() {
  return (
    <StudioLoadingScaffold
      eyebrow='Local-first production desk'
      layout='shell'
      railPanels={3}
      title='Control UykulukSciFi production from the web surface'
    />
  );
}
