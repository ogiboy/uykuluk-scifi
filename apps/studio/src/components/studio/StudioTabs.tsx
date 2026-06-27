"use client";

import { useEffect, useRef } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import gsap from "gsap";
import { FileText, Image, LockKeyhole, Terminal } from "lucide-react";
import { PromptInventoryView } from "@/components/prompts/PromptInventoryView";
import { Button } from "@/components/ui/button";
import type { StudioPromptInventory } from "@/lib/promptInventory";

const tabItems = [
  {
    value: "runs",
    label: "Runs",
    icon: Terminal,
    summary: "Run index and detail routes come next. CLI state remains canonical.",
  },
  {
    value: "prompts",
    label: "Prompts",
    icon: FileText,
    summary: "Prompt edits will need diff, hash, reason, and rollback metadata.",
  },
  {
    value: "assets",
    label: "Assets",
    icon: Image,
    summary: "Committed channel assets are ready for preview and render pipeline planning.",
  },
  {
    value: "safety",
    label: "Safety",
    icon: LockKeyhole,
    summary: "Upload and public/scheduled publish controls stay blocked by default.",
  },
];

export function StudioTabs({
  promptInventory,
}: Readonly<{ promptInventory: StudioPromptInventory }>) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelRef.current) {
      return;
    }
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
    );
  }, []);

  return (
    <section id='prompts' aria-labelledby='studio-tabs-heading'>
      <h2 id='studio-tabs-heading'>Studio Modules</h2>
      <Tabs.Root className='tabs-root' defaultValue='runs'>
        <Tabs.List className='tabs-list' aria-label='Studio modules'>
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <Tabs.Trigger className='tabs-trigger' key={item.value} value={item.value}>
                <Icon aria-hidden='true' size={16} />
                {item.label}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        {tabItems.map((item) => (
          <Tabs.Content className='tabs-content' key={item.value} value={item.value}>
            {item.value === "prompts" ? (
              <PromptInventoryView inventory={promptInventory} />
            ) : (
              <div ref={item.value === "runs" ? panelRef : undefined}>
                <h3>{item.label}</h3>
                <p>{item.summary}</p>
                <Button type='button' variant='secondary' disabled>
                  Planned
                </Button>
              </div>
            )}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </section>
  );
}
