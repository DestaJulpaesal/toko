import { Link } from 'react-router-dom';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export function Button({ variant = 'default', size, as, to, className, children, ...rest }) {
  const cls = cx('g-btn', variant === 'primary' && 'g-btn--primary', variant === 'danger' && 'g-btn--danger', size === 'sm' && 'g-btn--sm', className);
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  const Tag = as || 'button';
  return <Tag className={cls} type={Tag === 'button' ? rest.type || 'button' : undefined} {...rest}>{children}</Tag>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="g-page-header">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {actions && <div className="g-page-header__actions">{actions}</div>}
    </header>
  );
}

export function Panel({ title, className, children }) {
  return (
    <section className={cx('g-panel', className)}>
      {title && <h2 className="g-panel__title">{title}</h2>}
      {children}
    </section>
  );
}

export function StatGrid({ children }) { return <div className="g-stat-grid">{children}</div>; }

export function StatCard({ label, value, hint }) {
  return (
    <div className="g-stat">
      <div className="g-stat__label">{label}</div>
      <div className="g-stat__value">{value}</div>
      {hint && <div className="g-stat__hint">{hint}</div>}
    </div>
  );
}

/** Bungkus <table> supaya bisa scroll horizontal di HP. */
export function TableWrap({ children }) { return <div className="g-table-wrap">{children}</div>; }

export function Badge({ tone = 'neutral', children }) {
  return <span className={cx('g-badge', tone !== 'neutral' && `g-badge--${tone}`)}>{children}</span>;
}

export function EmptyState({ title = 'Belum ada data', hint }) {
  return <div className="g-empty"><strong>{title}</strong>{hint}</div>;
}
