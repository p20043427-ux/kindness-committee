import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize    = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  isLoading?: boolean;
  leftIcon?:  ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   "bg-primary-600 hover:bg-primary-700 text-white border border-transparent focus:ring-primary-500",
  secondary: "bg-white hover:bg-surface-50 text-surface-700 border border-surface-300 focus:ring-surface-400",
  ghost:     "bg-transparent hover:bg-surface-100 text-surface-600 hover:text-surface-800 border border-transparent focus:ring-surface-400",
  danger:    "bg-red-600 hover:bg-red-700 text-white border border-transparent focus:ring-red-500",
  outline:   "bg-transparent hover:bg-primary-50 text-primary-600 border border-primary-400 focus:ring-primary-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8  px-3   text-xs gap-1.5",
  md: "h-10 px-3.5 text-sm gap-2",
  lg: "h-12 px-4   text-sm gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant   = "secondary",
      size      = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center font-medium rounded transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {isLoading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
        : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  )
);
Button.displayName = "Button";
