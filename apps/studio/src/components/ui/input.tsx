import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot='input'
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-(--line) bg-[#0b0f14] px-3 py-1 text-base text-(--text) shadow-xs outline-none transition-[color,box-shadow] selection:bg-(--accent) selection:text-[#071012] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-(--text) placeholder:text-(--muted) disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-(--accent) focus-visible:ring-2 focus-visible:ring-(--accent)",
        "aria-invalid:border-(--danger) aria-invalid:ring-(--danger)",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
