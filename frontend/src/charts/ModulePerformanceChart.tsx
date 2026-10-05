import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ModulePerformance } from "../types/api";
import { C, axisProps } from "./palette";

export function ModulePerformanceChart({ data }: { data: ModulePerformance[] }) {
  const rows = data.map((m) => ({ name: m.name.split(" & ")[0].replace(" Protocol", ""), full: m.name,
    "Average score": m.average_score ?? 0, "Pass rate": m.pass_rate, "Completion rate": m.completion_rate }));
  return (
    <div role="img" aria-label="Grouped bar chart of average score, pass rate and completion rate for each training module" className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis domain={[0, 100]} unit="%" {...axisProps} />
          <Tooltip formatter={(v) => `${v}%`} labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""} cursor={{ fill: "rgba(37,102,156,.08)" }} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Average score" fill={C.blue} />
          <Bar dataKey="Pass rate" fill={C.pass} />
          <Bar dataKey="Completion rate" fill="#8a97a8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
