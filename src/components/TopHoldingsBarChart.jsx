import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts';
import { getIndustryColor } from '../utils/industryColors.js';

const CustomTooltip = ({ active, payload, scale = 1 }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm max-w-[220px]">
      <p className="font-semibold text-slate-800 mb-1">{d.stock_name}</p>
      {d.industry && (
        <p className="text-xs mb-1.5 font-medium" style={{ color: getIndustryColor(d.industry).hex }}>
          {d.industry}
        </p>
      )}
      <p className="font-bold" style={{ color: '#4472C4' }}>
        {(Number(d.pct_nav) * scale).toFixed(2)}% NAV
      </p>
    </div>
  );
};

export default function TopHoldingsBarChart({ data = [], scale = 1 }) {
  if (!data.length) return (
    <div className="h-72 flex items-center justify-center text-slate-400 text-sm">No data available</div>
  );

  const chartData = data.map(d => ({
    ...d,
    display_pct: parseFloat((Number(d.pct_nav) * scale).toFixed(4)),
    short_name: d.stock_name?.length > 22 ? d.stock_name.slice(0, 20) + '…' : d.stock_name,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis
          type="number"
          tickFormatter={v => `${v}%`}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="short_name"
          width={145}
          tick={{ fontSize: 11, fill: '#475569' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip scale={scale} />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="display_pct" radius={[0, 5, 5, 0]} maxBarSize={22}>
          {chartData.map((entry) => (
            <Cell
              key={entry.isin || entry.stock_name}
              fill={getIndustryColor(entry.industry).hex}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
