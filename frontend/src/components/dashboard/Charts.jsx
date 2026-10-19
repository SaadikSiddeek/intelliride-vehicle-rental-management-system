import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
export function RevenueChart({ data }) {
  return (
    <div
      className="revenue-chart"
      role="img"
      aria-label="Sample revenue trend, January 2,650 thousand rupees to December 4,286 thousand rupees"
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 260 }}>
        <AreaChart
          data={data}
          margin={{ top: 15, right: 10, left: -18, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.19} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            dy={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(v) => `${(v / 1000).toFixed(1)}m`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--foreground)",
            }}
            formatter={(v) => [
              `Rs. ${(v * 1000).toLocaleString()}`,
              "Sample revenue",
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill="url(#revenue-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function FleetDonut({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="fleet-chart">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Sample fleet of ${total} vehicles`}
      >
        <circle
          cx="100"
          cy="100"
          r="74"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="18"
        />
        {data.map((item, index) => {
          const length = (item.value / total) * 465;
          const offset = data.slice(0, index).reduce((sum, previous) => sum + (previous.value / total) * 465, 0);
          const el = (
            <circle
              key={item.label}
              cx="100"
              cy="100"
              r="74"
              fill="none"
              stroke={item.color}
              strokeWidth="18"
              strokeDasharray={`${Math.max(0, length - 4)} ${465 - length + 4}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 100 100)"
            />
          );
          return el;
        })}
        <text
          x="100"
          y="98"
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize="32"
          fontWeight="650"
        >
          {total}
        </text>
        <text
          x="100"
          y="122"
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize="11"
        >
          TOTAL VEHICLES
        </text>
      </svg>
      <div className="chart-legend">
        {data.map((item) => (
          <div key={item.label}>
            <span className="legend-dot" style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
