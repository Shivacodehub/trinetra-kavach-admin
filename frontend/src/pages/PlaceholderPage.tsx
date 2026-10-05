import { useLocation } from "react-router-dom";
import { Hammer } from "lucide-react";
import { Card } from "../components/Card";
import { titleFor } from "../router/nav";

/** Pages scheduled for Phase 4. The backend endpoints for all of them already exist (see /docs). */
export default function PlaceholderPage() {
  const { pathname } = useLocation();
  return (
    <Card className="mx-auto max-w-xl"><div className="flex flex-col items-center gap-2 py-8 text-center">
      <Hammer className="h-6 w-6 text-muted" aria-hidden />
      <p className="font-medium">{titleFor(pathname)} - planned for Phase 4</p>
      <p className="text-sm text-muted">The API for this page is already live. The screen has not been built yet.</p>
    </div></Card>
  );
}
