import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const colors = ['#26824d', '#d99a3b', '#4c8fa5', '#a76a9f', '#d16c58', '#788a59', '#7b75b2'];
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

function BreakdownTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return <div className="cashflow-chart-tooltip"><strong>{item.name}</strong><span><b>{money(item.value)}</b></span></div>;
}

export default function CategoryBreakdownChart({ data = [] }) {
  if (!data.length) return <div className="category-breakdown-empty"><span>Rp</span><strong>Belum ada pengeluaran</strong><p>Rincian kategori akan muncul setelah pengeluaran tunai dicatat.</p></div>;

  const total = data.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="category-breakdown-chart">
      <div className="category-breakdown-plot">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={58} outerRadius={84} paddingAngle={3} stroke="none">
              {data.map((item, index) => <Cell key={item.categoryId || item.category} fill={colors[index % colors.length]} />)}
            </Pie>
            <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fill="#8a948b" fontSize="11">Total keluar</text>
            <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" fill="#344138" fontSize="14" fontWeight="700">{money(total)}</text>
            <Tooltip content={<BreakdownTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="category-breakdown-legend">
        {data.map((item, index) => <div key={item.categoryId || item.category}><i style={{ backgroundColor: colors[index % colors.length] }} /><span>{item.category}</span><strong>{money(item.amount)}</strong></div>)}
      </div>
    </div>
  );
}
