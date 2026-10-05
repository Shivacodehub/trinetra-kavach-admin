import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-semibold text-ink-800">404</p><p className="text-sm text-muted">This page does not exist.</p>
      <Link to="/dashboard" className="text-sm font-medium text-steel-700 hover:underline">Go to dashboard</Link>
    </div>
  );
}
