"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import type { CSSProperties } from "react";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme='dark'
      className='toaster group'
      icons={{
        success: <CircleCheckIcon className='size-4' />,
        info: <InfoIcon className='size-4' />,
        warning: <TriangleAlertIcon className='size-4' />,
        error: <OctagonXIcon className='size-4' />,
        loading: <Loader2Icon className='size-4 animate-spin' />,
      }}
      style={
        {
          "--normal-bg": "var(--panel)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--line)",
          "--border-radius": "8px",
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
