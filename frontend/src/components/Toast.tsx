import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { IconButton } from "./IconButton";

type Kind = "success" | "error";
interface ToastItem { id: number; kind: Kind; message: string }
const Ctx = createContext<(kind: Kind, message: string) => void>(() => {});
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: Kind, message: string) => {
    const id = nextId++;
    setItems((l) => [...l, { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
  }, [dismiss]);
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast-in flex items-start gap-2 rounded-md border bg-white p-3 text-sm shadow-lg ${t.kind === "success" ? "border-ok-600" : "border-bad-600"}`}>
            {t.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok-600" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" aria-hidden />}
            <span className="flex-1">{t.message}</span>
            <IconButton label="Dismiss notification" onClick={() => dismiss(t.id)} className="-m-1"><X className="h-4 w-4" /></IconButton>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
