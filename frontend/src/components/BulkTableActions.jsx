import { Trash2, X } from 'lucide-react';

export default function BulkTableActions({ selectedCount, totalCount, allSelected, onToggleAll, onDelete, deleting = false }) {
  if (!totalCount) return null;

  return (
    <div className="bulk-table-actions">
      <label className="bulk-select-control">
        <input type="checkbox" checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} />
        <span>{allSelected ? 'Semua dipilih' : 'Pilih semua'}</span>
      </label>
      {selectedCount > 0 && (
        <div className="bulk-selected-actions">
          <span>{selectedCount} dipilih</span>
          <button type="button" className="bulk-delete-button" onClick={onDelete} disabled={deleting} title="Hapus data yang dipilih">
            <Trash2 size={14} />
            {deleting ? 'Menghapus...' : 'Hapus terpilih'}
          </button>
          <button type="button" className="bulk-clear-button" onClick={() => onToggleAll(false)} title="Batalkan pilihan" aria-label="Batalkan pilihan">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export function BulkRowCheckbox({ checked, onChange, label }) {
  return (
    <input
      className="bulk-row-checkbox"
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
    />
  );
}
