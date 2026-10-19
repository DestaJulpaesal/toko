import { useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export function Button({ variant = 'default', size, as, to, loading = false, className, children, ...rest }) {
  const cls = cx('g-btn', variant === 'primary' && 'g-btn--primary', variant === 'danger' && 'g-btn--danger', size === 'sm' && 'g-btn--sm', className);
  const content = <>{loading && <LoaderCircle size={16} className="g-spin" aria-hidden="true" />}{children}</>;
  if (to) return <Link to={to} className={cls} aria-busy={loading || undefined} {...rest}>{content}</Link>;
  const Tag = as || 'button';
  return <Tag className={cls} type={Tag === 'button' ? rest.type || 'button' : undefined} disabled={loading || rest.disabled} aria-busy={loading || undefined} {...rest}>{content}</Tag>;
}

export function PageHeader({ eyebrow, title, subtitle, description, actions }) {
  return (
    <header className="g-page-header">
      <div>{eyebrow && <span className="g-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{(subtitle || description) && <p>{subtitle || description}</p>}</div>
      {actions && <div className="g-page-header__actions">{actions}</div>}
    </header>
  );
}

export function Field({ label, hint, error, id, children, className = '' }) {
  return <div className={cx('g-field', className)}>{label && <label htmlFor={id}>{label}</label>}{children}{error ? <span className="g-field-error" role="alert">{error}</span> : hint ? <span className="g-field-hint">{hint}</span> : null}</div>;
}

export function Input(props) { return <input className={cx('g-ui-input', props.className)} {...props} />; }
export function Select(props) { return <select className={cx('g-ui-input', props.className)} {...props} />; }
export function Textarea(props) { return <textarea className={cx('g-ui-input', props.className)} {...props} />; }

export function Card({ title, description, actions, className = '', children }) {
  return <section className={cx('g-ui-card', className)}>{(title || description || actions) && <header className="g-ui-card__header"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{actions}</header>}{children}</section>;
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

export function EmptyState({ title = 'Belum ada data', hint, description, action }) {
  return <div className="g-empty"><span className="g-empty-state__icon"><Check size={20} /></span><strong>{title}</strong>{hint || description}{action}</div>;
}

export function Skeleton({ rows = 3, className = '' }) {
  return <div className={cx('g-skeleton-list', className)} aria-label="Memuat" role="status">{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>;
}

export function ErrorState({ title = 'Data belum dapat dimuat', description, onRetry }) {
  return <div className="g-error-state" role="alert"><AlertCircle size={20} /><div><strong>{title}</strong>{description && <p>{description}</p>}</div>{onRetry && <Button variant="default" size="sm" onClick={onRetry}>Coba lagi</Button>}</div>;
}

export function StatusBadge({ status, label }) {
  const normalized = String(status || '').toLowerCase();
  const tone = /paid|active|completed|ready|success|lunas/.test(normalized) ? 'success'
    : /pending|processing|warning|unpaid|hold/.test(normalized) ? 'warning'
      : /cancel|void|failed|error|overdue/.test(normalized) ? 'danger' : 'neutral';
  return <span className={`g-status-badge g-status-badge--${tone}`}><i />{label || status}</span>;
}

export function DataTable({
  columns, rows = [], rowKey = 'id', loading = false, error = '', onRetry,
  page = 1, pageSize = 50, total = rows.length, onPageChange, onPageSizeChange,
  selectedIds = [], onSelectionChange, rowTotal, onRowClick, density = 'comfortable', onDensityChange,
}) {
  const [localDensity, setLocalDensity] = useState(density);
  const activeDensity = onDensityChange ? density : localDensity;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const setDensity = (value) => (onDensityChange ? onDensityChange(value) : setLocalDensity(value));
  if (error) return <div className={`g-table-card g-table-card--${activeDensity}`}><ErrorState description={error} onRetry={onRetry} /></div>;
  if (loading) return <div className={`g-table-card g-table-card--${activeDensity}`}><Skeleton rows={Math.min(pageSize, 6)} /></div>;
  if (!rows.length) return <div className={`g-table-card g-table-card--${activeDensity}`}><EmptyState /></div>;
  const toggleAll = (checked) => onSelectionChange?.(checked ? rows.map((row) => row[rowKey]) : []);
  return (
    <div className={`g-table-card g-table-card--${activeDensity}`}>
      <div className="g-table-scroll"><table className="g-table">
        <thead><tr>
          {onSelectionChange && <th className="g-table-select"><input type="checkbox" aria-label="Pilih semua baris" checked={rows.length > 0 && rows.every((row) => selectedIds.includes(row[rowKey]))} onChange={(event) => toggleAll(event.target.checked)} /></th>}
          {columns.map((column) => <th key={column.key} className={`g-align-${column.align || 'left'} ${column.sticky ? 'g-sticky-column' : ''}`} style={{ width: column.width }}>{column.header}</th>)}
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row[rowKey]} onClick={onRowClick ? () => onRowClick(row) : undefined} tabIndex={onRowClick ? 0 : undefined} onKeyDown={onRowClick ? (event) => { if (event.key === 'Enter') onRowClick(row); } : undefined}>
          {onSelectionChange && <td className="g-table-select" data-label="Pilih"><input type="checkbox" aria-label={`Pilih baris ${row[rowKey]}`} checked={selectedIds.includes(row[rowKey])} onClick={(event) => event.stopPropagation()} onChange={(event) => onSelectionChange(event.target.checked ? [...selectedIds, row[rowKey]] : selectedIds.filter((id) => id !== row[rowKey]))} /></td>}
          {columns.map((column) => <td key={column.key} className={`g-align-${column.align || 'left'} ${column.sticky ? 'g-sticky-column' : ''}`} data-label={column.header}>{column.render ? column.render(row) : row[column.key]}</td>)}
        </tr>)}</tbody>
        {rowTotal && <tfoot><tr>{rowTotal.map((cell, index) => <td key={index}>{cell}</td>)}</tr></tfoot>}
      </table></div>
      <footer className="g-table-footer">
        <span>Menampilkan {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} dari {total.toLocaleString('id-ID')}</span>
        <label>Kepadatan <select value={activeDensity} onChange={(event) => setDensity(event.target.value)}><option value="comfortable">Nyaman</option><option value="compact">Ringkas</option></select></label>
        <label>Baris <select value={pageSize} onChange={(event) => onPageSizeChange?.(Number(event.target.value))}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
        <div className="g-table-pagination"><button type="button" aria-label="Halaman sebelumnya" disabled={!onPageChange || page <= 1} onClick={() => onPageChange?.(page - 1)}><ChevronLeft size={17} /></button><span>{page} / {pageCount}</span><button type="button" aria-label="Halaman berikutnya" disabled={!onPageChange || page >= pageCount} onClick={() => onPageChange?.(page + 1)}><ChevronRight size={17} /></button></div>
      </footer>
    </div>
  );
}
