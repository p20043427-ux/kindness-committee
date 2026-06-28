import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type InputSize = "sm" | "md" | "lg";

const sizeClasses: Record<InputSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3  text-xs",
  lg: "h-9 px-3  text-sm",
};

const base =
  "w-full rounded border bg-white text-surface-900 placeholder:text-surface-400 " +
  "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-primary-500 focus:border-primary-500";

/* ── Text Input ─────────────────────────────────────────────── */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: InputSize;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = "md", error, className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        base,
        error ? "border-red-400 focus:ring-red-500" : "border-surface-300",
        sizeClasses[inputSize],
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

/* ── Select ─────────────────────────────────────────────────── */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  inputSize?: InputSize;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ inputSize = "md", className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        base,
        "border-surface-300 cursor-pointer",
        sizeClasses[inputSize],
        className
      )}
      {...props}
    />
  )
);
Select.displayName = "Select";
