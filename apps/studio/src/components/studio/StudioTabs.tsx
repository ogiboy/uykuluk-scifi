"use client";

import { PromptInventoryView } from "@/components/prompts/PromptInventoryView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StudioPromptInventory } from "@/lib/promptInventory";
import gsap from "gsap";
import { FileText, Image, LockKeyhole, Terminal } from "lucide-react";
import { useEffect, useRef } from "react";

const tabItems = [
  {
    value: "runs",
    label: "Runs",
    icon: Terminal,
    status: "Active",
    summary: "Run index and detail routes come next. CLI state remains canonical.",
  },
  {
    value: "prompts",
    label: "Prompts",
    icon: FileText,
    status: "Read-only",
    summary: "Prompt edits will need diff, hash, reason, and rollback metadata.",
  },
  {
    value: "assets",
    label: "Assets",
    icon: Image,
    status: "Planned",
    summary: "Committed channel assets are ready for preview and render pipeline planning.",
  },
  {
    value: "safety",
    label: "Safety",
    icon: LockKeyhole,
    status: "Locked",
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
      <Tabs className='grid gap-3' defaultValue='runs'>
        <TabsList className='h-auto flex-wrap justify-start' aria-label='Studio modules'>
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger key={item.value} value={item.value}>
                <Icon aria-hidden='true' />
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {tabItems.map((item) => (
          <TabsContent
            className='bg-card/60 ring-border/5 rounded-lg p-4 ring-1'
            key={item.value}
            value={item.value}
          >
            {item.value === "prompts" ? (
              <PromptInventoryView inventory={promptInventory} />
            ) : (
              <Card ref={item.value === "runs" ? panelRef : undefined}>
                <CardHeader>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <CardTitle>{item.label}</CardTitle>
                      <CardDescription>{item.summary}</CardDescription>
                    </div>
                    <Badge variant={item.status === "Locked" ? "destructive" : "secondary"}>
                      {item.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator />
                  <p className='text-muted-foreground mt-3 max-w-3xl text-sm leading-6'>
                    This module remains a Studio surface over local CLI/core contracts. It must not
                    duplicate workflow state or infer approvals from files.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button type='button' variant='secondary' disabled>
                    Planned
                  </Button>
                </CardFooter>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
