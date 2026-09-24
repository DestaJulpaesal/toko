import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';

const formatMoney = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

/**
 * ProductUnitPicker Component
 * Displays available units for a product and allows selection
 * 
 * Props:
 *   - product: Product object with id
 *   - onSelectUnit: Callback when unit is selected
 *   - selectedUnitId: Currently selected unit ID
 */
export default function ProductUnitPicker({ product, onSelectUnit, selectedUnitId }) {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!product?.id) return;

    const loadUnits = async () => {
      setLoading(true);
      try {
        const response = await apiFetch(`/products/${product.id}/units`);
        const data = await response.json();
        if (data.success && Array.isArray(data.units)) {
          setUnits(data.units);
          // Auto-select first unit if none selected
          if (!selectedUnitId && data.units.length > 0) {
            onSelectUnit(data.units[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load units:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUnits();
  }, [product?.id, onSelectUnit, selectedUnitId]);

  if (units.length === 0) return null;

  return (
    <div className="unit-picker" style={{ marginBottom: '10px' }}>
      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>
        Pilih Unit:
      </label>
      <select
        value={selectedUnitId || ''}
        onChange={(e) => {
          const unit = units.find((u) => u.id === e.target.value);
          if (unit) onSelectUnit(unit);
        }}
        disabled={loading}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ddd',
          fontSize: '14px',
          marginTop: '5px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        <option value="">-- Pilih Unit --</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name} - {formatMoney(unit.sellingPrice)} (Stok: {unit.baseStockQty})
          </option>
        ))}
      </select>
    </div>
  );
}
