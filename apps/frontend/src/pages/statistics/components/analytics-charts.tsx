import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OperationalMonthlyPoint, VisaFunnelStage, VisaMonthlyPoint } from "../../../shared/analytics-types";
import { visaStageLabel } from "../../../shared/analytics-types";

const COLORS = {
  primary: "rgb(var(--color-primary))",
  secondary: "rgb(var(--color-secondary))",
  tertiary: "rgb(var(--color-tertiary))",
  axis: "rgb(var(--color-secondary))",
  grid: "rgb(var(--color-secondary) / 0.18)",
};

const axisTick = { fill: COLORS.axis, fontSize: 11, fontWeight: 600 };

const tooltipStyle = {
  borderRadius: "0.75rem",
  border: "1px solid rgb(var(--color-secondary) / 0.25)",
  background: "rgb(var(--color-surface-container-lowest, 255 255 255))",
  color: "rgb(var(--color-on-surface, 20 20 20))",
  fontSize: "0.8rem",
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
};

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-60 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function OperationalTrendChart({ data }: { data: OperationalMonthlyPoint[] }) {
  return (
    <ChartFrame>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgb(var(--color-secondary) / 0.08)" }} />
        <Legend wrapperStyle={{ fontSize: "0.75rem", fontWeight: 600 }} />
        <Bar name="Jamaah" dataKey="pax" fill={COLORS.primary} radius={[6, 6, 0, 0]} maxBarSize={38} />
        <Line
          name="Grup"
          type="monotone"
          dataKey="groups"
          stroke={COLORS.tertiary}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ChartFrame>
  );
}

export function VisaTrendChart({ data }: { data: VisaMonthlyPoint[] }) {
  return (
    <ChartFrame>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgb(var(--color-secondary) / 0.08)" }} />
        <Bar name="Jamaah Terbit" dataKey="issuedPax" fill={COLORS.primary} radius={[6, 6, 0, 0]} maxBarSize={38} />
      </ComposedChart>
    </ChartFrame>
  );
}

export function VisaFunnelChart({ data }: { data: VisaFunnelStage[] }) {
  const rows = data.map((item) => ({ ...item, label: visaStageLabel(item.stage) }));
  return (
    <ChartFrame>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 24 }}>
        <CartesianGrid stroke={COLORS.grid} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={axisTick} tickLine={false} axisLine={false} width={90} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgb(var(--color-secondary) / 0.08)" }} />
        <Bar name="Jamaah" dataKey="pax" radius={[0, 6, 6, 0]} maxBarSize={26}>
          {rows.map((row) => (
            <Cell key={row.stage} fill={row.stage === "ISSUED" ? COLORS.primary : COLORS.secondary} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
