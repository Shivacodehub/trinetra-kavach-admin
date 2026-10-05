const STEPS = ["Worker trains", "AR safety scenario", "Worker actions", "Assessment engine", "Score / pass-fail", "Certificate", "Admin monitoring"];

/** Shows where this dashboard sits in the ecosystem: it monitors results, it does not control the AR experience. */
export function FlowStrip() {
  return (
    <div>
      <ol className="flex flex-wrap items-center gap-y-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center">
            <span className={`rounded-sm border px-2 py-1 ${i < 6 ? "border-line-strong bg-surface" : "border-steel-600 bg-steel-100 font-semibold text-steel-700"}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="px-1.5 text-muted" aria-hidden>&rarr;</span>}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">Steps 1-6 run in the Android AR app. This web dashboard only monitors the results the app syncs to the server.</p>
    </div>
  );
}
