import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const colors = ['#1f7a4a', '#e3a438', '#5c8fe0', '#d86659', '#7f62b3', '#35a7a0'];
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

function BreakdownTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return <div className="finance-chart-tooltip"><strong>{item.name}</strong><span><i style={{ background: item.payload.fill }} />{money(item.value)}</span></div>;
}

export default function CategoryBreakdownChart({ data = [] }) {
  const total = data.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return <div className="finance-breakdown">
    <div className="finance-donut-chart"><ResponsiveContainer><PieChart>
      <Pie data={data} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} stroke="#fff" strokeWidth={3}>
        {data.map((item, index) => <Cell key={item.categoryId || item.category || index} fill={colors[index % colors.length]} />)}
      </Pie>
      <Tooltip content={<BreakdownTooltip />} />
    </PieChart></ResponsiveContainer><div className="finance-donut-center"><strong>{money(total)}</strong><span>Total</span></div></div>
    <div className="finance-breakdown-legend">{data.map((item, index) => <div key={item.categoryId || item.category || index}><span style={{ background: colors[index % colors.length] }} /><strong>{item.category || 'Tanpa kategori'}</strong><b>{money(item.amount)}</b></div>)}</div>
  </div>;
}
