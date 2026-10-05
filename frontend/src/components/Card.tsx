import type { ReactNode } from "react";

export function Card({ title, action, children, className = "", bodyClass = "p-4" }:
  { title?: string; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`rounded-md border border-line bg-white shadow-[0_1px_2px_rgba(16,30,51,.05)] ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-800">{title}</h2>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
