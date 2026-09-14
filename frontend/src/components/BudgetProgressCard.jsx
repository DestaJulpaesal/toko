const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
export default function BudgetProgressCard({ budget }) {
  const percentage = Math.min(Number(budget?.percentageUsed || 0), 100);
  return <article className={`budget-progress-card ${budget?.status?.toLowerCase() || 'ok'}`}><div><strong>{budget?.category?.name || 'Budget'}</strong><span>{money(budget?.spentAmount)} / {money(budget?.limitAmount)}</span></div><progress max="100" value={percentage} /><small>{Math.round(percentage)}% terpakai · sisa {money(budget?.remainingAmount)}</small></article>;
}
