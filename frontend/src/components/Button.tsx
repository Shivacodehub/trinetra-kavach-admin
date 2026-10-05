import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";

const styles = {
  primary: "bg-steel-700 text-white hover:bg-steel-600 disabled:bg-steel-700/50",
  secondary: "border border-line-strong bg-white text-ink-900 hover:bg-surface disabled:opacity-50",
  danger: "bg-bad-600 text-white hover:bg-bad-700 disabled:opacity-50",
} as const;

export function Button({ variant = "primary", loading, children, className = "", disabled, ...rest }:
  { variant?: keyof typeof styles; loading?: boolean } & ComponentProps<"button">) {
  return (
    <button {...rest} disabled={disabled || loading}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
