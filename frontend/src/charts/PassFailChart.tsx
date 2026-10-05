import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { C } from "./palette";

export function PassFailChart({ passed, failed }: { passed: number; failed: number }) {
  const data = [{ name: "Passed", value: passed, color: C.pass }, { name: "Failed", value: failed, color: C.fail }];
  const total = passed + failed;
  return (
    <div role="img" aria-label={`Donut chart: ${passed} passed, ${failed} failed`} className="relative h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 -mt-4 flex flex-col items-center justify-center">
        <span className="num text-2xl font-semibold">{total}</span><span className="text-[11px] text-muted">assessments</span>
      </div>
    </div>
  );
}
