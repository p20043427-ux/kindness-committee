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
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-colors",
        {
          "border-transparent bg-surface-700 text-white":
            variant === "default",
          "border-surface-200 bg-surface-100 text-surface-700":
            variant === "secondary",
          "border-transparent bg-red-600 text-white":
            variant === "destructive",
          "border-surface-300 text-surface-600 bg-transparent":
            variant === "outline",
          "border-green-200 bg-green-50 text-green-800":
            variant === "success",
          "border-amber-200 bg-amber-50 text-amber-800":
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
