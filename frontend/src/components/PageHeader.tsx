import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode }) {
  return (
    <div className="mb-4 print:hidden">
      {back && <Link to={back.to} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-steel-700 hover:underline"><ArrowLeft className="h-3 w-3" aria-hidden />{back.label}</Link>}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="text-xl font-semibold text-ink-900">{title}</h2>{subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}</div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
