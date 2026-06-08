import * as React from "react";
import { cn } from "@/src/lib/utils";

export interface BadgeProps {
  className?: string;
  children?: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-surface-900 text-surface-50 hover:bg-surface-900/80":
            variant === "default",
          "border-transparent bg-surface-100 text-surface-900 hover:bg-surface-100/80":
            variant === "secondary",
          "border-transparent bg-red-500 text-surface-50 hover:bg-red-500/80":
            variant === "destructive",
          "text-surface-950 border-surface-200": variant === "outline",
          "border-transparent bg-green-100 text-green-800 hover:bg-green-100/80":
            variant === "success",
          "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100/80":
            variant === "warning",
        },
        className
      )}
      {...(props as any)}
    >
      {children}
    </div>
  );
}

export { Badge };
