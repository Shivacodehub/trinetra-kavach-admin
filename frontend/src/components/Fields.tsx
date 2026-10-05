import type { ComponentProps, ReactNode } from "react";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebounced } from "../hooks/useFilters";

export const inputCls = "h-9 w-full rounded-md border border-line-strong bg-white px-2.5 text-sm disabled:bg-surface disabled:text-muted";

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-1 font-normal">{children}</div>
      {hint && !error && <span className="mt-0.5 block text-xs font-normal text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-0.5 block text-xs font-medium text-bad-700">{error}</span>}
    </label>
  );
}

export const TextInput = (p: ComponentProps<"input">) => <input {...p} className={`${inputCls} ${p.className ?? ""}`} />;
export const SelectInput = (p: ComponentProps<"select">) => <select {...p} className={`${inputCls} ${p.className ?? ""}`} />;

/** Debounced search box that writes to the URL filter state. */
export function SearchBox({ value, onSearch, placeholder, label }: { value: string; onSearch: (v: string) => void; placeholder: string; label: string }) {
  const [text, setText] = useState(value);
  const debounced = useDebounced(text);
  useEffect(() => setText(value), [value]);
  useEffect(() => { if (debounced.trim() !== value) onSearch(debounced.trim()); }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} aria-label={label} placeholder={placeholder} className={`${inputCls} pl-8`} />
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">{children}</div>;
}
