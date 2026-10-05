import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "../types/api";
import { C, axisProps } from "./palette";

const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export function CompletionTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div role="img" aria-label="Bar chart of completed assessments per day for the last 30 days, split into passed and failed" className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} interval="preserveStartEnd" minTickGap={28} {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip labelFormatter={(l) => short(String(l))} cursor={{ fill: "rgba(37,102,156,.08)" }} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="passed" name="Passed" stackId="a" fill={C.pass} />
          <Bar dataKey="failed" name="Failed" stackId="a" fill={C.fail} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
