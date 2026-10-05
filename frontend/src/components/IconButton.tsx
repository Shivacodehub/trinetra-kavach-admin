import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Every icon-only button needs a label: it becomes both the tooltip and the accessible name. */
export function IconButton({ label, children, className = "", ...rest }: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" title={label} aria-label={label} {...rest}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-black/5 hover:text-ink-900 ${className}`}>
      {children}
    </button>
  );
}
