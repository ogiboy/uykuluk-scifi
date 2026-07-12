"use client";

import { Tabs } from "@/components/ui/tabs";
import {
  runReviewPathWithTab,
  runReviewTabFromSearchParams,
  type RunReviewTab,
} from "@/lib/runs/runReviewNavigation";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type RunReviewTabsProps = Readonly<{ children: ReactNode; initialTab: RunReviewTab }>;

/**
 * Keeps the run review tab selection reflected in the local URL.
 *
 * @param children - Tab triggers and content panels.
 * @param initialTab - The tab selected by server-side run state and URL parsing.
 */
export function RunReviewTabs({ children, initialTab }: RunReviewTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = runReviewTabFromSearchParams(
    { tab: searchParams.get("tab") ?? undefined },
    initialTab,
  );

  function selectTab(value: string): void {
    const selectedTab = runReviewTabFromSearchParams({ tab: value }, tab);
    if (selectedTab === tab) {
      return;
    }
    const href = runReviewPathWithTab(pathname, searchParams, selectedTab) as Parameters<
      typeof router.replace
    >[0];
    router.replace(href, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={selectTab} className='grid min-w-0 gap-4'>
      {children}
    </Tabs>
  );
}
