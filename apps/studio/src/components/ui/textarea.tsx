import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot='textarea'
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-(--line) bg-[#0b0f14] px-3 py-2 text-base text-(--text) shadow-xs outline-none transition-[color,box-shadow] placeholder:text-[color:var(--muted)] focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[color:var(--danger)] aria-invalid:ring-[color:var(--danger)] md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
