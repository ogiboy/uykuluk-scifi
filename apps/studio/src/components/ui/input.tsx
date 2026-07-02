import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot='input'
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-[#0b0f14] px-3 py-1 text-base text-[color:var(--text)] shadow-xs outline-none transition-[color,box-shadow] selection:bg-[color:var(--accent)] selection:text-[#071012] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[color:var(--text)] placeholder:text-[color:var(--muted)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]",
        "aria-invalid:border-[color:var(--danger)] aria-invalid:ring-[color:var(--danger)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
