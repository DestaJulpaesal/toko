import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';

const formatMoney = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const unitsCache = new Map();

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
    const productId = product?.productId || product?.id;
    if (!productId) return undefined;
    let active = true;

    const loadUnits = async () => {
      if (unitsCache.has(productId)) {
        const cachedUnits = unitsCache.get(productId);
        setUnits(cachedUnits);
        if (!selectedUnitId && cachedUnits.length > 0) onSelectUnit(cachedUnits[0]);
        return;
      }
      setLoading(true);
      try {
        const response = await apiFetch(`/products/${productId}/units`, { silentNotify: true });
        const data = await response.json();
        if (active && data.success && Array.isArray(data.units)) {
          unitsCache.set(productId, data.units);
          setUnits(data.units);
          // Auto-select first unit if none selected
          if (!selectedUnitId && data.units.length > 0) {
            onSelectUnit(data.units[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load units:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadUnits();
    return () => {
      active = false;
    };
  }, [product?.productId, product?.id]);

  if (units.length === 0) return null;

  return (
    <div className="unit-picker">
      <label>
        Pilih Unit:
      </label>
      <select
        value={selectedUnitId || ''}
        onChange={(e) => {
          const unit = units.find((u) => u.id === e.target.value);
          if (unit) onSelectUnit(unit);
        }}
        disabled={loading}
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
