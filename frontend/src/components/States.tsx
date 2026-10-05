import { AlertTriangle, Inbox } from "lucide-react";
import { ApiError } from "../services/api";
import { Button } from "./Button";

export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`skeleton ${className}`} aria-hidden />;

export function ErrorState({ error, what, onRetry }: { error: unknown; what: string; onRetry?: () => void }) {
  const detail = error instanceof ApiError ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <AlertTriangle className="h-6 w-6 text-bad-600" aria-hidden />
      <p className="text-sm font-medium">Unable to load {what}. Please try again.</p>
      <p className="text-xs text-muted">{detail}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted">
      <Inbox className="h-6 w-6" aria-hidden />{message}
    </div>
  );
}
