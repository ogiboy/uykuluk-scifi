"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[color,box-shadow] hover:bg-[color:var(--panel)] hover:text-[color:var(--text)] focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-[color:var(--danger)] aria-invalid:ring-[color:var(--danger)] data-[state=on]:border-[color:var(--accent)] data-[state=on]:bg-[color:var(--panel-strong)] data-[state=on]:text-[color:var(--text)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-[color:var(--line)] bg-[#0b0f14] text-[color:var(--muted)] shadow-xs",
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot='toggle'
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
