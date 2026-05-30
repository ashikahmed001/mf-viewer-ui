import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { getIndustryColor } from '../utils/industryColors.js';

function fmtMonth(dateStr) {
  if (!dateStr) return '';
  // Parse YYYY-MM-DD without timezone conversion by splitting manually
  const [year, month] = String(dateStr).split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

const CustomTooltip = ({ active, payload, label, color }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="text-slate-500 text-xs mb-1">{fmtMonth(label)}</p>
      <p className="font-bold" style={{ color }}>{Number(payload[0].value).toFixed(2)}% NAV</p>
    </div>
  );
};

export default function TrendLineChart({ data = [], stockName, industry, scale = 1 }) {
  if (!data.length) return (
    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
      Select a stock to view its trend
    </div>
  );

  const color = getIndustryColor(industry).hex;

  // Deduplicate by calendar month (YYYY-MM) — keep last entry per month
  const seen = new Map();
  for (const d of data) {
    const monthKey = String(d.report_month).slice(0, 7); // "YYYY-MM"
    seen.set(monthKey, d);
  }
  const chartData = [...seen.values()].map(d => ({
    month: d.report_month,
    pct_nav: parseFloat((Number(d.pct_nav) * scale).toFixed(4)),
  }));

  const avg = chartData.reduce((a, b) => a + b.pct_nav, 0) / chartData.length;

  return (
    <div>
      {stockName && (
        <p className="text-sm font-semibold text-slate-700 mb-3 truncate">
          % NAV Trend — <span style={{ color }}>{stockName}</span>
          {industry && (
            <span className="ml-2 text-xs font-normal text-slate-400">{industry}</span>
          )}
        </p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tickFormatter={fmtMonth}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false} tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip color={color} />} />
          <ReferenceLine
            y={avg}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{ value: 'avg', fontSize: 10, fill: '#94a3b8' }}
          />
          <Line
            type="monotone" dataKey="pct_nav"
            stroke={color} strokeWidth={2.5}
            dot={{ fill: color, r: 4, strokeWidth: 2, stroke: 'white' }}
            activeDot={{ r: 6, fill: color, stroke: 'white', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
