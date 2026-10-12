import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const colors = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14'];
export default function CategoryBreakdownChart({ data = [] }) {
  return <div style={{ width: '100%', height: 280 }}><ResponsiveContainer><PieChart><Pie data={data} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={90} label>{data.map((item, index) => <Cell key={item.categoryId || item.category} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>;
}
