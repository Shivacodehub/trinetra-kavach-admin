import { useEffect, useRef } from "react";
import { Button } from "./Button";

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, danger }:
  { open: boolean; title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/50 p-4" onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" className="pop-in w-full max-w-sm rounded-md bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="dlg-title" className="text-base font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
