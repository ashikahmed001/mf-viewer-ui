import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getIndustryColor } from '../utils/industryColors.js';

const RADIAN = Math.PI / 180;

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.04) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
};

export default function IndustryPieChart({ data = [], scale = 1 }) {
  if (!data.length) return (
    <div className="h-72 flex items-center justify-center text-slate-400 text-sm">No data available</div>
  );

  const chartData = data.map(d => ({
    name: d.industry || 'Unknown',
    value: parseFloat(((d.total_pct_nav || 0) * scale).toFixed(2)),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%" cy="50%"
            innerRadius={65} outerRadius={115}
            paddingAngle={1.5}
            dataKey="value"
            labelLine={false}
            label={renderCustomLabel}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={getIndustryColor(entry.name).hex}
                stroke="white"
                strokeWidth={1.5}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(val) => [`${Number(val).toFixed(2)}%`, '% NAV']}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)',
              fontSize: '12px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Scrollable legend — colors match the pie slices exactly */}
      <div className="mt-3 max-h-40 overflow-y-auto border border-slate-100 rounded-xl p-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {chartData.map((item) => {
            const color = getIndustryColor(item.name);
            return (
              <div key={item.name} className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-xs text-slate-600 truncate" title={item.name}>
                  {item.name}
                </span>
                <span className="text-xs font-mono ml-auto flex-shrink-0" style={{ color: color.hex }}>
                  {item.value.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
