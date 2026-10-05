import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ModuleAnalytics } from "../types/api";
import { C, axisProps } from "./palette";

const margin = { top: 4, right: 8, left: -18, bottom: 0 };
const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const Box = ({ label, children, h = 240 }: { label: string; children: React.ReactElement; h?: number }) => (
  <div role="img" aria-label={label} style={{ height: h }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>);

export function ScoreDistributionChart({ data }: { data: ModuleAnalytics["score_distribution"] }) {
  return <Box label="Histogram of assessment scores in 10-point ranges, split into passed and failed">
    <BarChart data={data} margin={margin}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="range" {...axisProps} /><YAxis allowDecimals={false} {...axisProps} />
      <Tooltip cursor={{ fill: "rgba(37,102,156,.08)" }} /><Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
      <Bar dataKey="passed" name="Passed" stackId="s" fill={C.pass} /><Bar dataKey="failed" name="Failed" stackId="s" fill={C.fail} /></BarChart></Box>;
}

export function OrgPerformanceChart({ data }: { data: ModuleAnalytics["by_organization"] }) {
  const rows = data.map((d) => ({ name: d.organization.replace(" (Demo)", ""), "Average score": d.average_score, "Pass rate": d.pass_rate }));
  return <Box label="Average score and pass rate by organization">
    <BarChart data={rows} margin={margin}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="name" {...axisProps} interval={0} /><YAxis domain={[0, 100]} unit="%" {...axisProps} />
      <Tooltip formatter={(v) => `${v}%`} cursor={{ fill: "rgba(37,102,156,.08)" }} /><Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
      <Bar dataKey="Average score" fill={C.blue} /><Bar dataKey="Pass rate" fill={C.pass} /></BarChart></Box>;
}

export function WorkerPerformanceChart({ data }: { data: ModuleAnalytics["by_worker"] }) {
  const rows = data.slice(0, 12).map((d) => ({ name: d.name, "Average score": d.average_score }));
  return <Box label="Average score by worker" h={Math.max(220, rows.length * 28 + 40)}>
    <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 0 }}><CartesianGrid stroke={C.grid} horizontal={false} />
      <XAxis type="number" domain={[0, 100]} unit="%" {...axisProps} /><YAxis type="category" dataKey="name" width={110} {...axisProps} />
      <Tooltip formatter={(v) => `${v}%`} cursor={{ fill: "rgba(37,102,156,.08)" }} /><Bar dataKey="Average score" fill={C.blue} /></BarChart></Box>;
}

export function ModuleTimeChart({ data }: { data: ModuleAnalytics["over_time"] }) {
  return <Box label="Average score and number of attempts per day, last 30 days">
    <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}><CartesianGrid stroke={C.grid} vertical={false} />
      <XAxis dataKey="date" tickFormatter={short} {...axisProps} minTickGap={24} />
      <YAxis yAxisId="s" domain={[0, 100]} unit="%" {...axisProps} /><YAxis yAxisId="n" orientation="right" allowDecimals={false} {...axisProps} />
      <Tooltip labelFormatter={(l) => short(String(l))} /><Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
      <Line yAxisId="s" dataKey="average_score" name="Average score" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} />
      <Line yAxisId="n" dataKey="attempts" name="Attempts" stroke={C.amber} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} /></LineChart></Box>;
}
