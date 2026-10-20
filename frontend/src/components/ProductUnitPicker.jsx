const formatMoney = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function ProductUnitPicker({ product, onSelectUnit, selectedUnitId }) {
  const units = product?.units || [];

  if (units.length === 0) return null;

  const defaultUnit = units.find((unit) => unit.isDefault) || units[0];
  const selectedUnit = selectedUnitId || defaultUnit.id;

  return (
    <div className="unit-picker" style={{ marginBottom: '10px' }}>
      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>
        Pilih Unit:
      </label>
      <select
        value={selectedUnit}
        onChange={(event) => {
          const unit = units.find((item) => item.id === event.target.value);
          if (unit) onSelectUnit(unit);
        }}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ddd',
          fontSize: '14px',
          marginTop: '5px',
        }}
      >
        {units.map((unit) => {
          const variantConversion = Number(product.conversionToBase) || 1;
          const unitConversion = Number(unit.conversionToBase) || variantConversion;
          const available = Math.floor(Number(product.stock || 0) * variantConversion / unitConversion);
          return (
            <option key={unit.id} value={unit.id}>
              {unit.name} - {formatMoney(unit.sellPrice)} (Stok: {available})
            </option>
          );
        })}
      </select>
    </div>
  );
}
