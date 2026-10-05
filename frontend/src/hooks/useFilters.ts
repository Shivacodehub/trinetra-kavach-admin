import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/** Filter/sort/page state lives in the URL, so views can be linked, refreshed and navigated back to. */
export function useFilters() {
  const [sp, setSp] = useSearchParams();
  const get = (k: string) => sp.get(k) ?? "";
  const set = (patch: Record<string, string>) =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k));
      if (!("page" in patch)) n.delete("page");
      return n;
    }, { replace: true });
  const page = Math.max(1, Number(sp.get("page")) || 1);
  return { get, set, page, setPage: (p: number) => set({ page: String(p) }) };
}

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** If the current page no longer exists (filters/organization changed), go back to page 1. */
export function useClampPage(page: number, pages: number | undefined, setPage: (p: number) => void) {
  useEffect(() => { if (pages !== undefined && page > pages) setPage(1); }, [page, pages]); // eslint-disable-line react-hooks/exhaustive-deps
}
